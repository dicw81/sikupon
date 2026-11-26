import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FamilyWorkspace } from '../types';

export const SHARED_APP_URL =
  'https://ais-pre-7oqymdbabay2uim5iqy5ar-931313419598.asia-northeast1.run.app';

export function generateInviteCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function buildFamilyShareLink(workspaceId: string, inviteCode: string): string {
  const baseUrl =
    typeof window !== 'undefined' && !window.location.hostname.includes('ais-dev-')
      ? window.location.origin
      : SHARED_APP_URL;
  return `${baseUrl}/?keluarga=${encodeURIComponent(workspaceId)}&kode=${encodeURIComponent(inviteCode)}`;
}

export function parseInviteFromInput(rawInput: string): {
  workspaceId: string;
  inviteCode: string;
} | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const keluarga = url.searchParams.get('keluarga')?.trim();
    const kode = url.searchParams.get('kode')?.trim();
    if (keluarga && kode) {
      return { workspaceId: keluarga, inviteCode: kode };
    }
  } catch {
    // Check if user pasted "workspaceId:inviteCode" or "workspaceId/inviteCode"
    const parts = trimmed.split(/[:/\s]+/).filter(Boolean);
    if (parts.length === 2) {
      return { workspaceId: parts[0], inviteCode: parts[1] };
    }
  }
  return null;
}

export async function ensurePersonalWorkspaceAndMigrate(
  uid: string,
  displayName: string
): Promise<string> {
  const userRef = doc(db, 'users', uid);
  const cleanName = (displayName || 'Keluarga').trim().slice(0, 60);
  const defaultWorkspaceId = `ws_${uid}`;

  let activeWorkspaceId = defaultWorkspaceId;
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as { activeWorkspaceId?: string };
      if (data.activeWorkspaceId) {
        activeWorkspaceId = data.activeWorkspaceId;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  // Ensure default personal/family workspace exists
  const wsRef = doc(db, 'workspaces', defaultWorkspaceId);
  try {
    const wsSnap = await getDoc(wsRef);
    if (!wsSnap.exists()) {
      const inviteCode = generateInviteCode();
      const wb = writeBatch(db);
      wb.set(wsRef, {
        ownerId: uid,
        name: `Kupon BBM Keluarga ${cleanName}`,
        inviteCode,
        lastJoinCode: '',
        memberUids: [uid],
        memberNames: { [uid]: cleanName },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      wb.set(doc(db, 'workspaces', defaultWorkspaceId, 'invites', inviteCode), {
        workspaceId: defaultWorkspaceId,
        workspaceName: `Kupon BBM Keluarga ${cleanName}`,
        ownerId: uid,
        active: true,
        createdAt: serverTimestamp(),
      });
      await wb.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${defaultWorkspaceId}`);
  }

  // Persist activeWorkspaceId on user profile if missing
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && !userSnap.data().activeWorkspaceId) {
      await updateDoc(userRef, {
        activeWorkspaceId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  // Migrate any legacy docs created by this user without workspaceId/memberUids
  await migrateLegacyOwnerDocs(uid, defaultWorkspaceId);

  return activeWorkspaceId;
}

async function migrateLegacyOwnerDocs(uid: string, workspaceId: string): Promise<void> {
  const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
  const memberUids = wsSnap.exists()
    ? ((wsSnap.data().memberUids as string[]) || [uid])
    : [uid];

  const collectionsToMigrate = ['batches', 'coupons', 'distributions'] as const;
  for (const colName of collectionsToMigrate) {
    try {
      const snap = await getDocs(
        query(collection(db, colName), where('ownerId', '==', uid))
      );
      const legacyDocs = snap.docs.filter((d) => {
        const data = d.data();
        return !data.workspaceId || !Array.isArray(data.memberUids);
      });
      if (legacyDocs.length === 0) continue;

      for (let i = 0; i < legacyDocs.length; i += 350) {
        const chunk = legacyDocs.slice(i, i + 350);
        const wb = writeBatch(db);
        for (const d of chunk) {
          wb.update(doc(db, colName, d.id), {
            workspaceId,
            memberUids,
            updatedAt: serverTimestamp(),
          });
        }
        await wb.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, colName);
    }
  }
}

export async function joinWorkspaceWithInvite(
  workspaceId: string,
  inviteCode: string,
  uid: string,
  displayName: string
): Promise<{ workspaceName: string }> {
  const cleanName = (displayName || 'Anggota Keluarga').trim().slice(0, 60);
  const invitePath = `workspaces/${workspaceId}/invites/${inviteCode}`;

  let workspaceName = 'Ruang Kupon Keluarga';
  try {
    const inviteSnap = await getDoc(doc(db, 'workspaces', workspaceId, 'invites', inviteCode));
    if (!inviteSnap.exists() || inviteSnap.data().active !== true) {
      throw new Error('Link undangan keluarga tidak ditemukan atau sudah tidak berlaku.');
    }
    workspaceName = String(inviteSnap.data().workspaceName || workspaceName);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Link undangan')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  try {
    const wb = writeBatch(db);
    wb.update(doc(db, 'workspaces', workspaceId), {
      memberUids: arrayUnion(uid),
      [`memberNames.${uid}`]: cleanName,
      lastJoinCode: inviteCode,
      updatedAt: serverTimestamp(),
    });
    wb.update(doc(db, 'users', uid), {
      activeWorkspaceId: workspaceId,
      updatedAt: serverTimestamp(),
    });
    await wb.commit();
    return { workspaceName };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}`);
  }
}

export async function updateWorkspaceName(
  workspace: FamilyWorkspace,
  newName: string
): Promise<void> {
  const cleanName = newName.trim().slice(0, 100);
  if (cleanName.length < 2) {
    throw new Error('Nama ruang keluarga minimal 2 karakter.');
  }
  try {
    const wb = writeBatch(db);
    wb.update(doc(db, 'workspaces', workspace.id), {
      name: cleanName,
      updatedAt: serverTimestamp(),
    });
    wb.update(doc(db, 'workspaces', workspace.id, 'invites', workspace.inviteCode), {
      workspaceName: cleanName,
    });
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspace.id}`);
  }
}

export async function rotateWorkspaceInviteCode(
  workspace: FamilyWorkspace
): Promise<string> {
  const newCode = generateInviteCode();
  try {
    const wb = writeBatch(db);
    wb.update(doc(db, 'workspaces', workspace.id, 'invites', workspace.inviteCode), {
      active: false,
    });
    wb.set(doc(db, 'workspaces', workspace.id, 'invites', newCode), {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      ownerId: workspace.ownerId,
      active: true,
      createdAt: serverTimestamp(),
    });
    wb.update(doc(db, 'workspaces', workspace.id), {
      inviteCode: newCode,
      updatedAt: serverTimestamp(),
    });
    await wb.commit();
    return newCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspace.id}`);
  }
}

export async function switchActiveWorkspace(
  uid: string,
  workspaceId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeWorkspaceId: workspaceId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function syncWorkspaceMembersToDocs(
  workspace: FamilyWorkspace,
  docsByCollection: {
    batches: Array<{ id: string; memberUids?: string[] }>;
    coupons: Array<{ id: string; memberUids?: string[] }>;
    distributions: Array<{ id: string; memberUids?: string[] }>;
  }
): Promise<void> {
  const targetMembers = workspace.memberUids;
  if (!targetMembers || targetMembers.length === 0) return;

  const isSameMembers = (existingMembers?: string[]) => {
    if (!existingMembers) return false;
    if (existingMembers.length !== targetMembers.length) return false;
    const set = new Set(existingMembers);
    return targetMembers.every((m) => set.has(m));
  };

  const pendingUpdates: Array<{ col: 'batches' | 'coupons' | 'distributions'; id: string }> = [];
  for (const b of docsByCollection.batches) {
    if (!isSameMembers(b.memberUids)) pendingUpdates.push({ col: 'batches', id: b.id });
  }
  for (const c of docsByCollection.coupons) {
    if (!isSameMembers(c.memberUids)) pendingUpdates.push({ col: 'coupons', id: c.id });
  }
  for (const d of docsByCollection.distributions) {
    if (!isSameMembers(d.memberUids)) pendingUpdates.push({ col: 'distributions', id: d.id });
  }

  if (pendingUpdates.length === 0) return;

  for (let i = 0; i < pendingUpdates.length; i += 350) {
    const chunk = pendingUpdates.slice(i, i + 350);
    const wb = writeBatch(db);
    for (const item of chunk) {
      wb.update(doc(db, item.col, item.id), {
        memberUids: targetMembers,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await wb.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'workspace-member-sync');
    }
  }
}
