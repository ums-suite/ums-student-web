import type { PaymentStatus } from '../../core/api/finance.types';

/**
 * Pure payment-idempotency logic (SWEB-21/22, test-coverage NFR). Deliberately free of
 * HttpClient/DI/signals, mirroring `ums-admission-web`'s own `payment-idempotency.ts` reference
 * implementation one-for-one on the status vocabulary (this app's real `PaymentStatus` enum is
 * identical: `Initiated | Pending | Successful | Failed | Reconciled`, confirmed against the same
 * `ums-core` `PaymentStatus` domain enum) -- adapted here to `sessionStorage` persistence per this
 * app's own design-decisions.md decision (see `core/state/payment-session-storage.util.ts`),
 * rather than `ums-admission-web`'s in-memory-only pattern.
 *
 * Two invariants this module exists to enforce:
 * - Domain Invariant #3: a `Payment` is never shown as confirmed before the backend's own status
 *   reaches a genuinely successful terminal state -- {@link isConfirmedPaymentStatus} is the single
 *   place that question is answered.
 * - edge-cases.md "Fee-Payment Idempotency Key Survives a Network Drop...": {@link isTerminalPaymentStatus} decides when it is finally safe to clear a persisted pending attempt.
 */

const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  'Successful',
  'Failed',
  'Reconciled',
]);

const CONFIRMED_STATUSES: ReadonlySet<PaymentStatus> = new Set(['Successful', 'Reconciled']);

/** A status the gateway/webhook will never revise further -- polling should stop and the persisted pending attempt may finally be cleared. */
export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Domain Invariant #3's own boolean: only ever true for a webhook-verified success. `Initiated`
 * and `Pending` are never confirmed (obviously in flight); `Failed` is terminal but explicitly NOT
 * confirmed -- callers must check this, never merely {@link isTerminalPaymentStatus}, before
 * rendering any "paid" state.
 */
export function isConfirmedPaymentStatus(status: PaymentStatus): boolean {
  return CONFIRMED_STATUSES.has(status);
}

/**
 * A fresh `IdempotencyKey` per NEW payment attempt (never reused across attempts). Falls back to a
 * timestamp+random string on a runtime with no `crypto.randomUUID` (older mobile WebViews) --
 * never throws, since a payment screen must never hard-fail merely because it couldn't mint a
 * fancy UUID.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idempotency-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
