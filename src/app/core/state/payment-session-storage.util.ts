/**
 * design-decisions.md "Payment Idempotency-Key Persistence — Durable Across Reload, Not Just
 * In-Memory": the idempotency key plus the target `Invoice` id/amount is written to
 * `sessionStorage` **the instant a payment request is dispatched, before awaiting a response** --
 * not merely on success, unlike `ums-admission-web`'s own in-memory-only pattern (that repo's own
 * resolved decision, deliberately not this app's -- see design-decisions.md's own "Why" for the
 * distinction: student-web's fee-payment flow has the additional named failure mode of a
 * reload/relaunch after a network drop, edge-cases.md "Fee-Payment Idempotency Key Survives a
 * Network Drop Between Submit and Response").
 *
 * `sessionStorage`, not `localStorage` (deliberate): the value is not a credential and only needs
 * to survive a same-tab reload, not a full browser close -- keeping the exposure surface as narrow
 * as the problem requires, per design-decisions.md's own trade-off note. Cleared on logout
 * alongside the rest of session cleanup is the caller's own responsibility (this module is a pure
 * storage primitive, not a session-lifecycle hook).
 */
const STORAGE_KEY = 'ums-student-web:fees:pending-payment';

/**
 * `paymentId` starts `null` -- filled in once the initiating `POST /finance/payments` call
 * actually returns a `PaymentDto.id`. A `null` `paymentId` after a reload means the request left
 * the browser but no response (success or failure) was ever received -- see `fees.store.ts`'s own
 * doc for how that specific, harder case is handled (no "get payment by idempotency key" endpoint
 * exists to resume polling from the key alone, confirmed gap).
 */
export interface PendingPaymentAttempt {
  readonly idempotencyKey: string;
  readonly invoiceId: string;
  readonly amount: number;
  readonly currency: string;
  readonly paymentId: string | null;
}

export function readPendingPaymentAttempt(): PendingPaymentAttempt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingPaymentAttempt) : null;
  } catch {
    return null;
  }
}

export function writePendingPaymentAttempt(attempt: PendingPaymentAttempt): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // Best-effort only -- a private-browsing/storage-disabled session simply loses the ability to
    // resume-detect this specific attempt across a reload; it never blocks the payment call itself.
  }
}

export function clearPendingPaymentAttempt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort only.
  }
}
