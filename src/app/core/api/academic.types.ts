/**
 * `Academic` module DTOs (SWEB-5), verified directly against `ums-core`'s own
 * `UMS.Modules.Academic.Application/*` and `UMS.Modules.Academic.Api/Endpoints/*.cs` -- not
 * guessed. See each interface's own doc comment for the specific endpoint it corresponds to and
 * any confirmed gap against what this app's UI would ideally want.
 */

export interface SectionDto {
  readonly id: string;
  readonly code: string;
  /** `DayOfWeek` as a plain number: 0 = Sunday .. 6 = Saturday. */
  readonly dayOfWeek: number;
  /** `TimeOnly` as `"HH:mm:ss"`. */
  readonly start: string;
  readonly end: string;
}

export interface AssessmentDto {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface ExamDto {
  readonly id: string;
  readonly name: string;
  readonly assessments: readonly AssessmentDto[];
}

/**
 * `GET /api/v1/academic/course-offerings?semester={guid}` (any authenticated Student).
 *
 * **Confirmed gaps**: no department/instructor/time-slot filter query params exist server-side
 * (only `semester`) -- {@link AcademicApi.listCourseOfferings} filters client-side after fetch
 * (SWEB-11's offering browser facets). No `room` field exists anywhere on `SectionDto` either --
 * the "where is this room" affordance (§3.3, SWEB-16's scope, not this pass's) has no data source
 * yet. This DTO is ID-only: resolve `courseId` -> {@link CourseDto} for code/title/credit hours,
 * `instructorFacultyMemberId` -> a future Faculty-module read for a display name (out of this
 * app's consumed-module list per requirement-spec.md §6 except a read-only instructor name, which
 * has no confirmed endpoint yet either -- flagged, not built against a guess).
 */
export interface CourseOfferingDto {
  readonly id: string;
  readonly courseId: string;
  readonly semesterId: string;
  readonly departmentId: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly hasAvailableSeats: boolean;
  readonly instructorFacultyMemberId: string | null;
  readonly sections: readonly SectionDto[];
  readonly exams: readonly ExamDto[];
  readonly createdAt: string;
}

/** `GET /api/v1/academic/courses/{id}`. */
export interface CourseDto {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly creditHours: number;
  /** Prerequisite `Course` ids -- prerequisite *satisfaction* itself is never client-computed (see RegistrationStore/eligibility validator doc). */
  readonly prerequisites: readonly string[];
  readonly createdAt: string;
}

/** `GET /api/v1/academic/programs/{id}`. */
export interface ProgramDto {
  readonly id: string;
  readonly departmentId: string;
  readonly code: string;
  readonly name: string;
  readonly maxCreditsPerSemester: number;
  readonly requiresAdvisorApproval: boolean;
  readonly createdAt: string;
}

/**
 * `GET /api/v1/academic/academic-sessions/{id}`.
 *
 * **Confirmed gap**: no `isOpen`/registration-window-status boolean is exposed anywhere -- open
 * vs. closed is computed server-side only, at enroll/drop time, from `registrationStart`/
 * `registrationEnd`. `computeRegistrationWindowStatus` (`registration-eligibility.ts`) mirrors
 * that computation client-side for **display only** (design-decisions.md
 * "RegistrationWindow Open/Closed State Piggybacks on the Existing Seat-Poll Channel") -- the
 * server's own rejection at submit time (`enrollment.registration_window_closed`) remains the
 * sole authority, exactly like the seat gauge (Invariant §8.2).
 */
export interface SemesterDto {
  readonly id: string;
  readonly name: string;
  readonly registrationStart: string;
  readonly registrationEnd: string;
  readonly dropStart: string;
  readonly dropEnd: string;
}

export interface AcademicSessionDto {
  readonly id: string;
  readonly code: string;
  readonly semesters: readonly SemesterDto[];
  readonly createdAt: string;
}

/** Real backend enum values (`EnrollmentStatus`), not the requirement-spec's illustrative names -- see `registration.status.*` i18n keys for the UI-facing label mapping. */
export type EnrollmentStatus = 'Pending' | 'Active' | 'Dropped' | 'Completed';

/** `POST /api/v1/academic/enrollments`. */
export interface CreateEnrollmentRequest {
  readonly courseOfferingId: string;
  readonly sectionId: string;
  readonly prerequisiteOverrideReason: string | null;
}

/** `DELETE /api/v1/academic/enrollments/{id}` -- body required even on DELETE (ASP.NET minimal-API `[FromBody]`). */
export interface DropEnrollmentRequest {
  readonly reason: string | null;
}

export interface EnrollmentDto {
  readonly id: string;
  readonly studentId: string;
  readonly courseOfferingId: string;
  readonly semesterId: string;
  readonly sectionId: string;
  readonly status: EnrollmentStatus;
  readonly creditHours: number;
  readonly prerequisiteOverrideReason: string | null;
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly droppedAt: string | null;
}

/**
 * Student-facing published-only result row (`StudentResultQueryService.GetPublishedResultsAsync`)
 * -- filtered to `Published` `ResultPublication`s by construction server-side (Invariant §8.1).
 */
export interface StudentResultRowDto {
  readonly enrollmentId: string;
  readonly courseOfferingId: string;
  readonly courseId: string;
  readonly semesterId: string;
  readonly calculatedScore: number;
  readonly letterGrade: string;
  readonly creditHours: number;
  readonly publishedAt: string;
}

/**
 * `GET /api/v1/academic/students/{id}/transcript`. `overallAverageScore` is the one
 * backend-computed, authoritative aggregate figure this app may display as "CGPA" (Invariant
 * §8.4: "GPA/CGPA is never client-recomputed as authoritative") -- any further client-side
 * aggregation (e.g. a per-semester trend) must be visually/textually marked unofficial.
 */
export interface TranscriptDto {
  readonly studentId: string;
  readonly results: readonly StudentResultRowDto[];
  readonly overallAverageScore: number | null;
}
