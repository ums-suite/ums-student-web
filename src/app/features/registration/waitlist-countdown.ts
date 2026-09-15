/**
 * design-decisions.md "Waitlist Confirm-Window Enforcement — Client Safety Margin Ahead of Server
 * Deadline" (SWEB-15): a fixed 2-3s client-side safety margin disables the confirm action ahead of
 * the displayed countdown's zero point -- the server's own expiry remains authoritative regardless
 * (edge-cases.md "Waitlist Seat Offer Confirmation Window Expires While the Student Is Mid-Confirm").
 * Pure, DI-free logic so the countdown/margin arithmetic is exhaustively unit-testable.
 */

/** Chosen from the documented 2-3s range -- the midpoint, giving equal margin against both a fast and a slow network round trip. */
export const WAITLIST_CONFIRM_SAFETY_MARGIN_MS = 2_500;

export interface WaitlistCountdownState {
  /** Milliseconds remaining until the server-stated deadline, never negative. */
  readonly remainingMs: number;
  /** Whole seconds remaining, for display. */
  readonly remainingSeconds: number;
  /** True once within the safety margin of expiry (or past it) -- confirm must be disabled. */
  readonly withinSafetyMargin: boolean;
  /** True once the deadline itself has passed. */
  readonly expired: boolean;
}

export function computeWaitlistCountdown(expiresAt: string, now: Date): WaitlistCountdownState {
  const deadline = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, deadline - now.getTime());

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    withinSafetyMargin: remainingMs <= WAITLIST_CONFIRM_SAFETY_MARGIN_MS,
    expired: remainingMs <= 0,
  };
}

/** Whether the confirm action may be dispatched right now -- false once inside the safety margin, never merely at literal zero. */
export function canDispatchWaitlistConfirm(state: WaitlistCountdownState): boolean {
  return !state.withinSafetyMargin;
}
