import type {
  CourseDto,
  CourseOfferingDto,
  EnrollmentStatus,
  SectionDto,
} from '../../core/api/academic.types';

/** A `CourseOffering` joined with its resolved `Course` (code/title/credit hours/prerequisites) for display (SWEB-11). */
export interface OfferingViewModel {
  readonly offering: CourseOfferingDto;
  readonly course: CourseDto | null;
}

export type RegistrationWindowStatus = 'open' | 'closed' | 'unknown';

/** The in-progress "my schedule" selection, before submit (SWEB-14). Distinct from a confirmed `EnrollmentDto`. */
export interface ScheduleSelection {
  readonly offeringId: string;
  readonly sectionId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly creditHours: number;
  readonly section: SectionDto;
}

/**
 * Pre-submission eligibility (SWEB-12). Every flag here is a **UX convenience computed from
 * already-published/already-known client data** -- never authoritative. The submit call
 * (`AcademicApi.createEnrollment`) always re-validates server-side regardless of what this shows
 * (edge-cases.md "Prerequisite/curriculum change mid-registration"), and the seat-availability
 * flag specifically must never gate the Register control (design-decisions.md "Seat-Gauge Trust
 * Boundary", Invariant §8.2).
 */
export interface EligibilityResult {
  readonly prerequisitesSatisfied: boolean;
  readonly missingPrerequisiteCourseIds: readonly string[];
  readonly creditLimitOk: boolean;
  readonly creditsUsed: number;
  readonly creditsMax: number;
  readonly timetableConflict: boolean;
  readonly conflictingSelections: readonly ScheduleSelection[];
  readonly seatsAvailable: boolean;
}

/** A tracked enrollment this app knows about, joined with display info (SWEB-13). */
export interface TrackedEnrollment {
  readonly enrollmentId: string;
  readonly status: EnrollmentStatus;
  readonly offeringId: string;
  readonly sectionId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly creditHours: number;
}

/**
 * Classified reason for a registration/drop rejection (SWEB-12/SWEB-13), derived from
 * `UmsApiError.code` -- never re-derived from a generic HTTP status alone, so the UI can show the
 * exact specific message each edge case requires (edge-cases.md, design-decisions.md).
 */
export type EnrollmentRejectionReason =
  | 'prerequisite'
  | 'creditLimit'
  | 'timetableConflict'
  | 'seatUnavailable'
  | 'windowClosed'
  | 'statusRejection'
  | 'generic';

/**
 * Waitlist (SWEB-15). **Confirmed gap, not merely unconfirmed**: `ums-core`'s Academic module has
 * no waitlist concept for course enrollment at all today (verified -- `EnrollmentStatus` has no
 * `Waitlisted` member, no endpoint/DTO/service exists; the only real waitlist in `ums-core` is
 * Hostel's bed-allocation waitlist, an unrelated feature). Built here against a documented,
 * assumed contract per this flow's own instruction to build client-side realtime/queue
 * infrastructure ahead of a confirmed backend contract rather than skip it -- every method in
 * `WaitlistApi` will 404 against the real backend until Academic ships this, and this is flagged
 * in the PR, not silently assumed to work end-to-end.
 */
export interface WaitlistPositionResponse {
  readonly position: number | null;
  readonly offer: { readonly expiresAt: string } | null;
}
