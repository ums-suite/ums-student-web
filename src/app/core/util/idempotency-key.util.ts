/**
 * A fresh, generic `IdempotencyKey` generator (glossary `IdempotencyKey`) -- used everywhere this
 * app must guard a mutating call against a double-submit/network-retry: Fees' payment initiation
 * (SWEB-21, header-borne) and Hostel's complaint submission (SWEB-25, body-borne field). Pulled
 * out of `features/fees/payment-idempotency.ts` (which re-exports it for backward compatibility)
 * since the concept itself is not payment-specific.
 *
 * Falls back to a timestamp+random string on a runtime with no `crypto.randomUUID` (older mobile
 * WebViews) -- never throws, since a mutating action must never hard-fail merely because it
 * couldn't mint a fancy UUID.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idempotency-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
