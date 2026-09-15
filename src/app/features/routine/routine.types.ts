import type { AssessmentDto } from '../../core/api/academic.types';

/**
 * One class block on the weekly grid (SWEB-16, requirement-spec.md §3.3/§7). Sourced by joining
 * the student's own tracked `Enrollment`s (same-browser localStorage tracking,
 * `core/state/enrollment-tracking.util.ts` -- the same confirmed "no list my enrollments" gap
 * `RegistrationStore` already documents) against each `Enrollment.courseOfferingId`'s
 * `CourseOfferingDto.sections`.
 *
 * **Confirmed gap**: `SectionDto` has no room field at all (`academic.types.ts`
 * `CourseOfferingDto` doc) -- `roomId` here is always `null`. The "where is this room" affordance
 * (§3.3) therefore cannot auto-resolve a room per class; `RoutineComponent` instead offers a
 * general building/room directory (`OrganizationApi`) alongside the grid rather than fabricating a
 * link that doesn't exist server-side.
 */
export interface RoutineBlock {
  readonly enrollmentId: string;
  readonly offeringId: string;
  readonly sectionId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly creditHours: number;
  readonly dayOfWeek: number;
  readonly start: string;
  readonly end: string;
  readonly roomId: null;
}

/**
 * A course's exam list for the exam-period overlay (SWEB-16). **Confirmed gap**: `ExamDto`/
 * `Exam` carry no scheduled date/time anywhere server-side (only `name` + weighted
 * `assessments`) -- there is nothing to place on a specific grid cell. Rendered as a distinct
 * "Exams (no scheduled date yet)" list alongside the grid rather than a fabricated calendar
 * overlay, per this app's own "never invent data" discipline.
 */
export interface RoutineExamGroup {
  readonly offeringId: string;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly examId: string;
  readonly examName: string;
  readonly assessments: readonly AssessmentDto[];
}

/** One 30-minute grid row's worth of vertical placement for a {@link RoutineBlock}. */
export interface RoutineGridPlacement {
  readonly rowStart: number;
  readonly rowSpan: number;
  readonly dayColumn: number;
}
