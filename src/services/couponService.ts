import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Coupon, CouponBatch, Distribution, FuelType } from '../types';
import { buildSerialNumber, getTodayISO, summarizeSerials } from '../utils/formatters';

function sanitizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export async function ensureUserProfile(
  uid: string,
  displayName: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: sanitizeText(displayName || 'Anggota Keluarga', 100),
        roleLabel: 'Pengelola Kupon Keluarga',
        unitName: 'Keluarga',
        activeWorkspaceId: `ws_${uid}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  data: { displayName: string; roleLabel: string; unitName: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeText(data.displayName || 'Anggota Keluarga', 100),
      roleLabel: sanitizeText(data.roleLabel || 'Pengelola Kupon', 60),
      unitName: sanitizeText(data.unitName || '', 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CreateBatchInput {
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  batchCode: string;
  source: string;
  receivedByOfficial: string;
  receivedDate: string;
  fuelType: FuelType;
  nominalValue: number;
  litersPerCoupon: number;
  prefix: string;
  startNumber: number;
  endNumber: number;
  notes: string;
}

export async function createCouponBatchWithCoupons(input: CreateBatchInput): Promise<string> {
  const startNum = Math.max(1, Math.floor(input.startNumber));
  const endNum = Math.max(startNum, Math.floor(input.endNumber));
  const totalCount = endNum - startNum + 1;

  if (totalCount < 1 || totalCount > 200) {
    throw new Error('Jumlah kupon dalam satu batch harus antara 1 hingga 200 lembar.');
  }

  const batchRef = doc(collection(db, 'batches'));
  const batchId = batchRef.id;
  const batchCode = sanitizeText(input.batchCode, 40);
  const source = sanitizeText(input.source, 120);
  const receivedByOfficial = sanitizeText(input.receivedByOfficial, 100);
  const prefix = sanitizeText(input.prefix, 24);
  const notes = sanitizeText(input.notes, 300);
  const memberUids = Array.from(new Set([input.ownerId, ...input.memberUids])).slice(0, 15);

  const wb = writeBatch(db);
  wb.set(batchRef, {
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    memberUids,
    batchCode,
    source,
    receivedByOfficial,
    receivedDate: input.receivedDate,
    fuelType: input.fuelType,
    nominalValue: Math.max(0, Number(input.nominalValue) || 0),
    litersPerCoupon: Math.max(0, Number(input.litersPerCoupon) || 0),
    prefix,
    startNumber: startNum,
    endNumber: endNum,
    totalCount,
    notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (let seq = startNum; seq <= endNum; seq += 1) {
    const couponRef = doc(collection(db, 'coupons'));
    const serialNumber = sanitizeText(buildSerialNumber(prefix, seq), 40);
    wb.set(couponRef, {
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      memberUids,
      batchId,
      batchCode,
      serialNumber,
      sequenceNumber: seq,
      fuelType: input.fuelType,
      nominalValue: Math.max(0, Number(input.nominalValue) || 0),
      litersPerCoupon: Math.max(0, Number(input.litersPerCoupon) || 0),
      receivedByOfficial,
      receivedDate: input.receivedDate,
      status: 'Tersedia',
      distributionId: '',
      recipientName: '',
      recipientUnit: '',
      vehiclePlate: '',
      distributedByName: '',
      distributedDate: '',
      usedDate: '',
      receiptNumber: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await wb.commit();
    return batchId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `batches/${batchId}`);
  }
}

export interface CreateDistributionInput {
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  handoverNumber: string;
  recipientName: string;
  recipientUnit: string;
  vehiclePlate: string;
  purpose: string;
  distributedByName: string;
  distributedDate: string;
  notes: string;
  selectedCoupons: Coupon[];
}

export async function createDistributionAndAssignCoupons(
  input: CreateDistributionInput
): Promise<string> {
  if (input.selectedCoupons.length === 0 || input.selectedCoupons.length > 100) {
    throw new Error('Pilih antara 1 hingga 100 kupon tersedia untuk dibagikan.');
  }

  const availableCoupons = input.selectedCoupons.filter((c) => c.status === 'Tersedia');
  if (availableCoupons.length !== input.selectedCoupons.length) {
    throw new Error('Sebagian kupon yang dipilih sudah tidak berstatus Tersedia.');
  }

  const distRef = doc(collection(db, 'distributions'));
  const distId = distRef.id;
  const recipientName = sanitizeText(input.recipientName, 100);
  const recipientUnit = sanitizeText(input.recipientUnit, 100);
  const vehiclePlate = sanitizeText(input.vehiclePlate.toUpperCase(), 24);
  const distributedByName = sanitizeText(input.distributedByName, 100);
  const handoverNumber = sanitizeText(input.handoverNumber, 40);
  const purpose = sanitizeText(input.purpose, 240);
  const notes = sanitizeText(input.notes, 300);
  const memberUids = Array.from(new Set([input.ownerId, ...input.memberUids])).slice(0, 15);

  const totalNominal = availableCoupons.reduce((acc, c) => acc + c.nominalValue, 0);
  const totalLiters = availableCoupons.reduce((acc, c) => acc + c.litersPerCoupon, 0);
  const serialSummary = sanitizeText(summarizeSerials(availableCoupons), 200);
  const couponIds = availableCoupons.map((c) => c.id);

  const wb = writeBatch(db);
  wb.set(distRef, {
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    memberUids,
    handoverNumber,
    recipientName,
    recipientUnit,
    vehiclePlate,
    purpose,
    distributedByName,
    distributedDate: input.distributedDate,
    couponCount: availableCoupons.length,
    totalNominal,
    totalLiters,
    serialSummary,
    couponIds,
    status: 'Aktif',
    notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const coupon of availableCoupons) {
    wb.update(doc(db, 'coupons', coupon.id), {
      status: 'Dibagikan',
      distributionId: distId,
      recipientName,
      recipientUnit,
      vehiclePlate,
      distributedByName,
      distributedDate: input.distributedDate,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await wb.commit();
    return distId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `distributions/${distId}`);
  }
}

export async function markCouponUsed(
  couponId: string,
  usedDate: string,
  receiptNumber: string
): Promise<void> {
  const path = `coupons/${couponId}`;
  try {
    await updateDoc(doc(db, 'coupons', couponId), {
      status: 'Terpakai',
      usedDate,
      receiptNumber: sanitizeText(receiptNumber, 60),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function returnCouponToStock(couponId: string): Promise<void> {
  const path = `coupons/${couponId}`;
  try {
    await updateDoc(doc(db, 'coupons', couponId), {
      status: 'Tersedia',
      distributionId: '',
      recipientName: '',
      recipientUnit: '',
      vehiclePlate: '',
      distributedByName: '',
      distributedDate: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelCoupon(couponId: string): Promise<void> {
  const path = `coupons/${couponId}`;
  try {
    await updateDoc(doc(db, 'coupons', couponId), {
      status: 'Dibatalkan',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function completeDistribution(
  distribution: Distribution,
  relatedCoupons: Coupon[],
  usedDate: string,
  receiptPrefix: string
): Promise<void> {
  const wb = writeBatch(db);
  wb.update(doc(db, 'distributions', distribution.id), {
    status: 'Selesai',
    notes: sanitizeText(distribution.notes, 300),
    updatedAt: serverTimestamp(),
  });

  const pendingCoupons = relatedCoupons.filter((c) => c.status === 'Dibagikan');
  for (const coupon of pendingCoupons) {
    wb.update(doc(db, 'coupons', coupon.id), {
      status: 'Terpakai',
      usedDate,
      receiptNumber: sanitizeText(
        receiptPrefix ? `${receiptPrefix}-${coupon.sequenceNumber}` : `LPR-${coupon.serialNumber}`,
        60
      ),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `distributions/${distribution.id}`);
  }
}

export async function cancelDistributionAndReturnCoupons(
  distribution: Distribution,
  relatedCoupons: Coupon[]
): Promise<void> {
  const wb = writeBatch(db);
  wb.update(doc(db, 'distributions', distribution.id), {
    status: 'Dibatalkan',
    notes: sanitizeText(
      distribution.notes
        ? `${distribution.notes} (Dibatalkan)`
        : 'Pembagian dibatalkan, kupon kembali ke stok',
      300
    ),
    updatedAt: serverTimestamp(),
  });

  const distributedCoupons = relatedCoupons.filter((c) => c.status === 'Dibagikan');
  for (const coupon of distributedCoupons) {
    wb.update(doc(db, 'coupons', coupon.id), {
      status: 'Tersedia',
      distributionId: '',
      recipientName: '',
      recipientUnit: '',
      vehiclePlate: '',
      distributedByName: '',
      distributedDate: '',
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `distributions/${distribution.id}`);
  }
}

export async function updateBatchMetadata(
  batch: CouponBatch,
  updates: { source: string; receivedByOfficial: string; notes: string }
): Promise<void> {
  const path = `batches/${batch.id}`;
  try {
    await updateDoc(doc(db, 'batches', batch.id), {
      source: sanitizeText(updates.source, 120),
      receivedByOfficial: sanitizeText(updates.receivedByOfficial, 100),
      notes: sanitizeText(updates.notes, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedSampleData(
  ownerId: string,
  workspaceId: string,
  memberUids: string[],
  staffName: string
): Promise<void> {
  const today = getTodayISO();
  const cleanMembers = Array.from(new Set([ownerId, ...memberUids])).slice(0, 15);

  const wbCreate = writeBatch(db);
  const batch1Ref = doc(collection(db, 'batches'));
  const batch2Ref = doc(collection(db, 'batches'));

  wbCreate.set(batch1Ref, {
    ownerId,
    workspaceId,
    memberUids: cleanMembers,
    batchCode: 'BATCH-2026-11-PTX',
    source: 'Alokasi Bulanan Keluarga',
    receivedByOfficial: 'Ayah / Kepala Keluarga',
    receivedDate: today,
    fuelType: 'Pertamax',
    nominalValue: 100000,
    litersPerCoupon: 8,
    prefix: 'PTX-26-',
    startNumber: 1,
    endNumber: 20,
    totalCount: 20,
    notes: 'Alokasi kupon BBM Pertamax kendaraan keluarga bulan berjalan.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  wbCreate.set(batch2Ref, {
    ownerId,
    workspaceId,
    memberUids: cleanMembers,
    batchCode: 'BATCH-2026-11-DXL',
    source: 'SPBU Mitra 34-12901',
    receivedByOfficial: 'Ibu / Pengelola',
    receivedDate: today,
    fuelType: 'Dexlite',
    nominalValue: 150000,
    litersPerCoupon: 10,
    prefix: 'DXL-26-',
    startNumber: 1,
    endNumber: 10,
    totalCount: 10,
    notes: 'Kupon kendaraan diesel operasional keluarga.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch1CouponIds: string[] = [];
  for (let seq = 1; seq <= 20; seq += 1) {
    const cRef = doc(collection(db, 'coupons'));
    batch1CouponIds.push(cRef.id);
    wbCreate.set(cRef, {
      ownerId,
      workspaceId,
      memberUids: cleanMembers,
      batchId: batch1Ref.id,
      batchCode: 'BATCH-2026-11-PTX',
      serialNumber: buildSerialNumber('PTX-26-', seq),
      sequenceNumber: seq,
      fuelType: 'Pertamax',
      nominalValue: 100000,
      litersPerCoupon: 8,
      receivedByOfficial: 'Ayah / Kepala Keluarga',
      receivedDate: today,
      status: 'Tersedia',
      distributionId: '',
      recipientName: '',
      recipientUnit: '',
      vehiclePlate: '',
      distributedByName: '',
      distributedDate: '',
      usedDate: '',
      receiptNumber: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const batch2CouponIds: string[] = [];
  for (let seq = 1; seq <= 10; seq += 1) {
    const cRef = doc(collection(db, 'coupons'));
    batch2CouponIds.push(cRef.id);
    wbCreate.set(cRef, {
      ownerId,
      workspaceId,
      memberUids: cleanMembers,
      batchId: batch2Ref.id,
      batchCode: 'BATCH-2026-11-DXL',
      serialNumber: buildSerialNumber('DXL-26-', seq),
      sequenceNumber: seq,
      fuelType: 'Dexlite',
      nominalValue: 150000,
      litersPerCoupon: 10,
      receivedByOfficial: 'Ibu / Pengelola',
      receivedDate: today,
      status: 'Tersedia',
      distributionId: '',
      recipientName: '',
      recipientUnit: '',
      vehiclePlate: '',
      distributedByName: '',
      distributedDate: '',
      usedDate: '',
      receiptNumber: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await wbCreate.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batches');
  }

  const wbDist = writeBatch(db);
  const dist1Ref = doc(collection(db, 'distributions'));
  const dist2Ref = doc(collection(db, 'distributions'));
  const dist1CouponIds = batch1CouponIds.slice(0, 6);
  const dist2CouponIds = batch2CouponIds.slice(0, 5);
  const cleanStaff = sanitizeText(staffName || 'Pengelola Keluarga', 100);

  wbDist.set(dist1Ref, {
    ownerId,
    workspaceId,
    memberUids: cleanMembers,
    handoverNumber: 'BAST-2026-001',
    recipientName: 'Budi Santoso',
    recipientUnit: 'Keluarga Inti',
    vehiclePlate: 'B 1042 KQN',
    purpose: 'Pengisian rutin kendaraan harian',
    distributedByName: cleanStaff,
    distributedDate: today,
    couponCount: 6,
    totalNominal: 600000,
    totalLiters: 48,
    serialSummary: 'PTX-26-0001 s/d PTX-26-0006 (6 lembar)',
    couponIds: dist1CouponIds,
    status: 'Aktif',
    notes: 'Simpan struk SPBU untuk dicatat di laporan.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dist1CouponIds.forEach((cid) => {
    wbDist.update(doc(db, 'coupons', cid), {
      status: 'Dibagikan',
      distributionId: dist1Ref.id,
      recipientName: 'Budi Santoso',
      recipientUnit: 'Keluarga Inti',
      vehiclePlate: 'B 1042 KQN',
      distributedByName: cleanStaff,
      distributedDate: today,
      updatedAt: serverTimestamp(),
    });
  });

  wbDist.set(dist2Ref, {
    ownerId,
    workspaceId,
    memberUids: cleanMembers,
    handoverNumber: 'BAST-2026-002',
    recipientName: 'Dedi Kurniawan',
    recipientUnit: 'Sopir Keluarga',
    vehiclePlate: 'B 9210 PQW',
    purpose: 'Perjalanan luar kota akhir pekan',
    distributedByName: cleanStaff,
    distributedDate: today,
    couponCount: 5,
    totalNominal: 750000,
    totalLiters: 50,
    serialSummary: 'DXL-26-0001 s/d DXL-26-0005 (5 lembar)',
    couponIds: dist2CouponIds,
    status: 'Aktif',
    notes: 'Kendaraan diesel keluarga.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dist2CouponIds.forEach((cid) => {
    wbDist.update(doc(db, 'coupons', cid), {
      status: 'Dibagikan',
      distributionId: dist2Ref.id,
      recipientName: 'Dedi Kurniawan',
      recipientUnit: 'Sopir Keluarga',
      vehiclePlate: 'B 9210 PQW',
      distributedByName: cleanStaff,
      distributedDate: today,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await wbDist.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'distributions');
  }

  const wbUsed = writeBatch(db);
  dist1CouponIds.slice(0, 4).forEach((cid, idx) => {
    wbUsed.update(doc(db, 'coupons', cid), {
      status: 'Terpakai',
      usedDate: today,
      receiptNumber: `SPBU-34129-${4401 + idx}`,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await wbUsed.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'coupons');
  }
}
