import type { CourseDto, SectionDto, SemesterDto } from '../../core/api/academic.types';
import type { UmsApiError } from '@ums/shared';
import type {
  EligibilityResult,
  EnrollmentRejectionReason,
  RegistrationWindowStatus,
  ScheduleSelection,
} from './registration.types';

/**
 * Pure course-registration eligibility/validation logic (SWEB-12, test-coverage NFR: "≥85% on
 * stores/validators (registration eligibility... logic)"). Deliberately free of HttpClient/DI/
 * signals so it is trivially, exhaustively unit-testable -- mirrors `ums-admission-web`'s
 * "pure logic lives outside the component/store" convention (e.g. `payment-idempotency.ts`).
 *
 * Every function here computes a **display-only, non-authoritative** preview. The server's own
 * atomic checks at submit time (`AcademicApi.createEnrollment`) are the sole authority for every
 * one of these checks -- see each function's own doc comment.
 */

/**
 * design-decisions.md "RegistrationWindow Open/Closed State Piggybacks on the Existing Seat-Poll
 * Channel": no backend flag exists for this (`SemesterDto` only carries raw
 * `registrationStart`/`registrationEnd` dates -- confirmed gap, `academic.types.ts`), so this
 * mirrors the server's own window-boundary semantics (`Semester.IsRegistrationOpen`) client-side,
 * recomputed fresh on every poll tick alongside the seat gauge. The server's own submit-time
 * rejection (`enrollment.registration_window_closed`) remains the final backstop regardless of
 * what this returns (edge-cases.md "Registration Window Closes Mid-Selection, Between Poll
 * Cycles").
 */
export function computeRegistrationWindowStatus(
  semester: SemesterDto,
  now: Date,
): RegistrationWindowStatus {
  const start = new Date(semester.registrationStart).getTime();
  const end = new Date(semester.registrationEnd).getTime();
  const current = now.getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 'unknown';
  }

  return current >= start && current <= end ? 'open' : 'closed';
}

/**
 * A UX-only prerequisite preview (green chip once satisfied), derived from the student's own
 * already-published, already-passed course ids (Invariant §8.1 -- the source data is
 * Published-only by construction). **Never authoritative**: the real check happens server-side at
 * submit (`enrollment.prerequisite_not_met`), re-validated regardless of what this shows
 * (edge-cases.md "Prerequisite/curriculum change mid-registration" -- a `Curriculum` update
 * invalidates a previously-green chip and this function has no way to know that ahead of submit).
 */
export function computeMissingPrerequisites(
  course: CourseDto,
  completedCourseIds: ReadonlySet<string>,
): readonly string[] {
  return course.prerequisites.filter((prereqId) => !completedCourseIds.has(prereqId));
}

/** Credit-limit preview against the program's `maxCreditsPerSemester` -- re-validated server-side at submit (`enrollment.credit_limit_exceeded`). */
export function computeCreditLimitUsage(
  currentSelections: readonly ScheduleSelection[],
  candidateCreditHours: number,
  maxCreditsPerSemester: number,
): { readonly creditsUsed: number; readonly creditsMax: number; readonly ok: boolean } {
  const used =
    currentSelections.reduce((total, s) => total + s.creditHours, 0) + candidateCreditHours;
  return {
    creditsUsed: used,
    creditsMax: maxCreditsPerSemester,
    ok: used <= maxCreditsPerSemester,
  };
}

/** Whether two sections meet on the same day with overlapping time ranges (`"HH:mm:ss"` strings compare correctly as plain strings). */
export function doSectionsConflict(a: SectionDto, b: SectionDto): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) {
    return false;
  }
  return a.start < b.end && b.start < a.end;
}

/** Every already-selected schedule entry that would conflict with `candidateSection` -- re-validated server-side at submit (`enrollment.timetable_conflict`). */
export function findTimetableConflicts(
  currentSelections: readonly ScheduleSelection[],
  candidateSection: SectionDto,
): readonly ScheduleSelection[] {
  return currentSelections.filter((selection) =>
    doSectionsConflict(selection.section, candidateSection),
  );
}

/** Composes every pre-submission check into one {@link EligibilityResult} for a candidate offering/section. */
export function buildEligibility(input: {
  readonly course: CourseDto | null;
  readonly section: SectionDto;
  readonly candidateCreditHours: number;
  readonly completedCourseIds: ReadonlySet<string>;
  readonly currentSelections: readonly ScheduleSelection[];
  readonly maxCreditsPerSemester: number;
  readonly hasAvailableSeats: boolean;
}): EligibilityResult {
  const missingPrerequisiteCourseIds = input.course
    ? computeMissingPrerequisites(input.course, input.completedCourseIds)
    : [];

  const creditLimit = computeCreditLimitUsage(
    input.currentSelections,
    input.candidateCreditHours,
    input.maxCreditsPerSemester,
  );

  const conflictingSelections = findTimetableConflicts(input.currentSelections, input.section);

  return {
    prerequisitesSatisfied: missingPrerequisiteCourseIds.length === 0,
    missingPrerequisiteCourseIds,
    creditLimitOk: creditLimit.ok,
    creditsUsed: creditLimit.creditsUsed,
    creditsMax: creditLimit.creditsMax,
    timetableConflict: conflictingSelections.length > 0,
    conflictingSelections,
    seatsAvailable: input.hasAvailableSeats,
  };
}

/**
 * Whether the pre-submission checks (prerequisite/credit-limit/timetable) all pass -- deliberately
 * EXCLUDES `seatsAvailable` (design-decisions.md "Seat-Gauge Trust Boundary": "the gauge is pure
 * display and never gates the Register control... a student can always attempt to register
 * against whatever the gauge shows"). Callers use this to decide whether to show a warning banner
 * next to Register, never to disable the button itself.
 */
export function hasBlockingClientSideIssue(eligibility: EligibilityResult): boolean {
  return (
    !eligibility.prerequisitesSatisfied ||
    !eligibility.creditLimitOk ||
    eligibility.timetableConflict
  );
}

const KNOWN_ERROR_CODES: Readonly<Record<string, EnrollmentRejectionReason>> = {
  'enrollment.prerequisite_not_met': 'prerequisite',
  'enrollment.credit_limit_exceeded': 'creditLimit',
  'enrollment.timetable_conflict': 'timetableConflict',
  'enrollment.seat_no_longer_available': 'seatUnavailable',
  'enrollment.registration_window_closed': 'windowClosed',
  'enrollment.drop_window_closed': 'windowClosed',
  'enrollment.student_not_active': 'statusRejection',
  'enrollment.no_student_record': 'statusRejection',
  'enrollment.not_owned': 'statusRejection',
};

/**
 * Classifies a rejected register/drop call's error code into the exact reason the UI must show a
 * specific message for (edge-cases.md "seat taken", "prerequisite/curriculum change", design-
 * decisions.md "Registration Feature-Area Exit on Student-Status Rejection") -- never a generic
 * catch-all when a known code is present.
 */
export function classifyEnrollmentError(error: UmsApiError): EnrollmentRejectionReason {
  return (error.code && KNOWN_ERROR_CODES[error.code]) || 'generic';
}

/** design-decisions.md "Registration Feature-Area Exit on Student-Status Rejection": any registration-adjacent rejection classified this way triggers a full redirect, not a per-call toast. */
export function isStatusRejection(reason: EnrollmentRejectionReason): boolean {
  return reason === 'statusRejection';
}
