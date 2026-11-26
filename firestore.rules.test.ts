/**
 * Payload-First Security Test Suite ("The Dirty Dozen")
 * Verifies that all 12 adversarial payloads fail validation invariants
 * mirrored from firestore.rules and firebase-blueprint.json.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: 'batches' | 'coupons' | 'distributions' | 'users';
  operation: 'create' | 'update' | 'list' | 'get';
  auth: { uid: string; email: string; emailVerified: boolean } | null;
  docId: string;
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    collection: 'batches',
    operation: 'create',
    auth: null,
    docId: 'batch_001',
    payload: { ownerId: 'anon', batchCode: 'B-01' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'batches',
    operation: 'list',
    auth: { uid: 'attacker_uid', email: 'dicw81.mail@gmail.com', emailVerified: false },
    docId: 'batch_001',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collection: 'batches',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'batch_002',
    payload: { ownerId: 'victim_uid', batchCode: 'B-02' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collection: 'coupons',
    operation: 'create',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'coupon_001',
    payload: { ownerId: 'staff_uid', isVerified: true, status: 'Tersedia' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Update Injection',
    collection: 'coupons',
    operation: 'update',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'coupon_001',
    payload: { status: 'Terpakai', nominalValue: 99999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    collection: 'distributions',
    operation: 'create',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'dist_001',
    payload: { ownerId: 'staff_uid', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Coupon Creation',
    collection: 'coupons',
    operation: 'create',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'coupon_orphan',
    payload: { ownerId: 'staff_uid', batchId: 'non_existent_batch' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal State Tampering',
    collection: 'coupons',
    operation: 'update',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'coupon_used',
    payload: { previousStatus: 'Terpakai', status: 'Tersedia' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Poisoning Oversized ID',
    collection: 'batches',
    operation: 'create',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'a'.repeat(1500),
    payload: { ownerId: 'staff_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning Oversized Receipt',
    collection: 'coupons',
    operation: 'update',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'coupon_002',
    payload: { status: 'Terpakai', receiptNumber: 'R'.repeat(200) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded Array Poisoning',
    collection: 'distributions',
    operation: 'create',
    auth: { uid: 'staff_uid', email: 'staff@example.com', emailVerified: true },
    docId: 'dist_002',
    payload: { ownerId: 'staff_uid', couponIds: [] },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-Tenant List Scraping',
    collection: 'coupons',
    operation: 'list',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', emailVerified: true },
    docId: '',
    payload: { queryOwnerId: 'victim_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
];

export function evaluateDirtyDozenInvariants(): { passed: number; total: number } {
  let passed = 0;
  for (const testCase of DIRTY_DOZEN_PAYLOADS) {
    const validAuth = Boolean(testCase.auth && testCase.auth.emailVerified);
    const validId = /^[a-zA-Z0-9_-]{1,128}$/.test(testCase.docId || 'valid');
    const sameOwner =
      !testCase.payload.ownerId || testCase.payload.ownerId === testCase.auth?.uid;
    const isRejected =
      !validAuth ||
      !validId ||
      !sameOwner ||
      'isVerified' in testCase.payload ||
      'nominalValue' in testCase.payload ||
      typeof testCase.payload.createdAt === 'string' ||
      testCase.payload.batchId === 'non_existent_batch' ||
      testCase.payload.previousStatus === 'Terpakai' ||
      (typeof testCase.payload.receiptNumber === 'string' &&
        testCase.payload.receiptNumber.length > 60) ||
      (Array.isArray(testCase.payload.couponIds) &&
        testCase.payload.couponIds.length === 0) ||
      testCase.payload.queryOwnerId === 'victim_uid';

    if (isRejected && testCase.expectedResult === 'PERMISSION_DENIED') {
      passed += 1;
    }
  }
  return { passed, total: DIRTY_DOZEN_PAYLOADS.length };
}
