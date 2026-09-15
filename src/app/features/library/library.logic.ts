import type { UmsApiError } from '@ums/shared';

/**
 * Pure Library logic (SWEB-26/27, test-coverage NFR). Deliberately free of HttpClient/DI/signals.
 */

/**
 * Classified reservation-submission rejection reasons (SWEB-27), derived from
 * `UmsApiError.code` -- confirmed against `ReservationService`'s real error codes, never guessed.
 *
 * **Confirmed gap, documented here rather than silently worked around**: edge-cases.md's "Library
 * reservation race" describes two students racing for "the last queued position" on a fully-loaned
 * `Book`, with the loser seeing "someone reserved this just before you". The real backend has no
 * such condition -- a reservation queue is uncapped (`Priority` is a plain incrementing int, no
 * server-side cap), so two concurrent reservation attempts for an already-fully-loaned book both
 * simply succeed at different queue positions; there is no "someone reserved the last slot before
 * you" outcome to lose. The one real, closely-related race the backend *does* reject is
 * `reservation.copy_available` -- a copy freed up between browse and submit, so the student should
 * borrow directly instead of reserving. This is treated as the closest real analogue: a specific,
 * non-generic "the situation changed under you" message, fulfilling the edge case's spirit (never
 * a silent failure) without fabricating a race outcome the backend cannot actually produce.
 */
export type ReservationRejectionReason = 'copyNowAvailable' | 'alreadyQueued' | 'generic';

const KNOWN_RESERVATION_ERROR_CODES: Readonly<Record<string, ReservationRejectionReason>> = {
  'reservation.copy_available': 'copyNowAvailable',
  'reservation.already_queued': 'alreadyQueued',
};

export function classifyReservationError(error: UmsApiError): ReservationRejectionReason {
  return (error.code && KNOWN_RESERVATION_ERROR_CODES[error.code]) || 'generic';
}

/** Whole-number days remaining until `dueDate` (negative once overdue) -- display only; `LoanDto.isOverdue` remains the authoritative overdue flag. */
export function daysUntilDue(dueDate: string, now: Date): number {
  const due = new Date(dueDate).getTime();
  const diffMs = due - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/** Whether a reservation's claim window has passed, purely for display -- `ReservationDto.status` (`Expired`) remains the authoritative source once the backend catches up. */
export function isClaimWindowExpired(claimWindowExpiresAt: string | null, now: Date): boolean {
  if (!claimWindowExpiresAt) {
    return false;
  }
  return new Date(claimWindowExpiresAt).getTime() < now.getTime();
}
