# Security Specification: SiKupon BBM

## 1. Data Invariants
1. **Verified Identity**: All read and write operations require an authenticated Firebase user with `request.auth.token.email_verified == true`.
2. **Ownership Integrity**: Every `CouponBatch`, `Coupon`, and `Distribution` document is strictly bound to `ownerId == request.auth.uid` on creation, and `ownerId` is immutable on update.
3. **Referential Integrity & Atomicity**:
   - A `Coupon` cannot be created without a valid `batchId` that exists (or is atomically created via `existsAfter` in the same `writeBatch`).
   - A `Coupon` transitioning to `'Dibagikan'` must reference a valid `distributionId` that exists (or is atomically created via `existsAfter` in the same `writeBatch`).
4. **Terminal State Locking**: Once a `Coupon` reaches `'Terpakai'` or `'Dibatalkan'`, or a `Distribution` reaches `'Selesai'` or `'Dibatalkan'`, it cannot be mutated by non-admin clients.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`; `createdAt` is immutable on update.
6. **Volumetric & Type Bounds**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`size <= 128`), every string enforces strict `.size()` bounds, `couponIds` array is bounded `<= 100`, and unknown/shadow keys are rejected via `hasAll` + `hasOnly` and `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Create**: Creating a batch without `request.auth` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: User with `email: 'dicw81.mail@gmail.com'` and `email_verified: false` reading or writing -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: Creating a `CouponBatch` with `ownerId: 'victim_uid'` different from `request.auth.uid` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Creating a `Coupon` with an extra ghost key `{ isVerified: true }` -> `PERMISSION_DENIED`.
5. **Shadow Update Injection**: Updating a `Coupon` status while injecting `{ nominalValue: 9999999 }` or `{ extraField: 1 }` -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Creating a `Distribution` with a backdated client timestamp instead of `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
7. **Orphaned Coupon Creation**: Creating a `Coupon` pointing to a non-existent `batchId` -> `PERMISSION_DENIED`.
8. **State Shortcutting / Terminal State Tampering**: Updating a `Coupon` whose existing status is `'Terpakai'` or `'Dibatalkan'` back to `'Tersedia'` -> `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized ID)**: Accessing or creating `/batches/<1500-char-id>` -> `PERMISSION_DENIED`.
10. **Value Poisoning (Oversized String / Invalid Enum)**: Updating `Coupon.status` to `'Gratis'` or setting `receiptNumber` > 60 chars -> `PERMISSION_DENIED`.
11. **Unbounded Array / Type Poisoning**: Creating a `Distribution` with `couponIds: []` or `couponIds` > 100 elements or non-string element `[123]` -> `PERMISSION_DENIED`.
12. **Cross-Tenant List Scraping**: Querying `coupons` without filtering to `ownerId == request.auth.uid` -> `PERMISSION_DENIED`.
