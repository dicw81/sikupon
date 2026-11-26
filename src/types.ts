import { Timestamp } from 'firebase/firestore';

export type FuelType = 'Pertamax' | 'Pertalite' | 'Dexlite' | 'Solar';

export type CouponStatus = 'Tersedia' | 'Dibagikan' | 'Terpakai' | 'Dibatalkan';

export type DistributionStatus = 'Aktif' | 'Selesai' | 'Dibatalkan';

export type AppTab = 'dashboard' | 'inventory' | 'distributions' | 'reports';

export interface UserProfile {
  uid: string;
  displayName: string;
  roleLabel: string;
  unitName: string;
  activeWorkspaceId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FamilyWorkspace {
  id: string;
  ownerId: string;
  name: string;
  inviteCode: string;
  lastJoinCode: string;
  memberUids: string[];
  memberNames: Record<string, string>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CouponBatch {
  id: string;
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
  totalCount: number;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Coupon {
  id: string;
  ownerId: string;
  workspaceId: string;
  memberUids: string[];
  batchId: string;
  batchCode: string;
  serialNumber: string;
  sequenceNumber: number;
  fuelType: FuelType;
  nominalValue: number;
  litersPerCoupon: number;
  receivedByOfficial: string;
  receivedDate: string;
  status: CouponStatus;
  distributionId: string;
  recipientName: string;
  recipientUnit: string;
  vehiclePlate: string;
  distributedByName: string;
  distributedDate: string;
  usedDate: string;
  receiptNumber: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Distribution {
  id: string;
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
  couponCount: number;
  totalNominal: number;
  totalLiters: number;
  serialSummary: string;
  couponIds: string[];
  status: DistributionStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
