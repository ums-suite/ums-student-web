import type { CourseOfferingDto } from '../../core/api/academic.types';

/**
 * Pure seat-gauge display logic (SWEB-11, §7 "a live seat-availability gauge (a small radial/bar
 * fill, red under a configurable threshold)"). Invariant §8.2 / design-decisions.md "Seat-Gauge
 * Trust Boundary" governs this file's entire reason to exist: every value here is **pure
 * display**, never used to gate the Register control (see `registration-eligibility.ts`
 * `hasBlockingClientSideIssue`, which deliberately excludes seat availability).
 */
export const DEFAULT_LOW_SEAT_THRESHOLD = 3;

export function seatsRemaining(
  offering: Pick<CourseOfferingDto, 'capacity' | 'enrolledCount'>,
): number {
  return Math.max(0, offering.capacity - offering.enrolledCount);
}

export function seatGaugeTone(
  offering: Pick<CourseOfferingDto, 'capacity' | 'enrolledCount' | 'hasAvailableSeats'>,
  lowSeatThreshold: number = DEFAULT_LOW_SEAT_THRESHOLD,
): 'success' | 'warning' | 'danger' {
  if (!offering.hasAvailableSeats) {
    return 'danger';
  }
  return seatsRemaining(offering) <= lowSeatThreshold ? 'warning' : 'success';
}
