import type { StudentResultRowDto } from '../../core/api/academic.types';
import type { GeneratedDocumentDto } from '../../core/api/documents.types';
import type { StudentRequestStatus } from '../../core/api/student.types';

/**
 * One semester's published `Grade` rows (SWEB-17), grouped client-side from
 * `TranscriptDto.results` -- every row here is already Published-only *by construction*
 * server-side (Invariant §8.1, `StudentResultQueryService.GetPublishedResultsAsync`'s own
 * per-row `ResultPublicationStatus.Published` check, confirmed by direct source read), never
 * re-filtered client-side because there is nothing left to filter.
 *
 * **Confirmed gap -- no per-semester GPA exists anywhere server-side** (only
 * `TranscriptDto.overallAverageScore`, a single flat all-time average, confirmed via direct
 * `StudentResultQueryService`/`ITranscriptQuery`/`IAcademicTranscriptPort` source inspection).
 * {@link averageScore} here is therefore an **unofficial, client-computed preview** only --
 * labeled as such everywhere it renders (Invariant §8.4), mirroring the exact same pattern
 * `DashboardStore`'s already-merged `buildSemesterScoreTrend` established for its sparkline. It is
 * never called "GPA" in any UI copy, to avoid it being mistaken for the one authoritative figure
 * ({@link ResultsSnapshot.overallAverageScore}).
 */
export interface SemesterGradeGroup {
  readonly semesterId: string;
  /** A chronological ordinal ("Semester 1", "Semester 2", ...) derived from each group's earliest `publishedAt` -- a display simplification, not a resolved `Semester.name` (no endpoint resolves an arbitrary semester id to a name without the same "no session discovery" gap `RegistrationStore` already documents). */
  readonly ordinalLabel: string;
  readonly courses: readonly StudentResultRowDto[];
  readonly averageScore: number;
  readonly creditHoursTotal: number;
}

/** One point on the GPA/score trend chart (SWEB-18) -- `averageScore` is the same unofficial per-semester preview as {@link SemesterGradeGroup.averageScore}. */
export interface GpaTrendPoint {
  readonly semesterId: string;
  readonly ordinalLabel: string;
  readonly averageScore: number;
}

/**
 * The official Transcript PDF request/tracking sub-flow (SWEB-19). **Confirmed gap**: a student
 * cannot self-serve an instant PDF download -- transcript `GeneratedDocument` generation is only
 * ever triggered server-side by `Student`'s `StudentRequestService` once a `TranscriptRequest`
 * (a `StudentRequest`, SWEB-28's own domain type) is *approved*, not at submission time. This
 * tracks that one request the same same-browser way `RegistrationStore` tracks `Enrollment` ids
 * (no "list my requests" endpoint exists either).
 *
 * **Confirmed gap -- locale is silently ignored.** The Documents module's generation pipeline
 * does accept a `Language` parameter end-to-end, but the specific adapter Student's
 * `StudentRequestService` calls for a `TranscriptRequest` (`DocumentGenerationPortAdapter.
 * RequestTranscriptAsync`) hardcodes it to `null` -- so today, a transcript PDF always renders in
 * the server's fallback/English template regardless of what a student picks here. This app still
 * *offers* a locale choice (records the student's preference in the request's `purpose` note) so
 * the UI is ready the moment the backend adapter is fixed, but never claims it takes effect.
 */
export interface TranscriptPdfRequestState {
  readonly requestId: string | null;
  readonly status: StudentRequestStatus | null;
  readonly document: GeneratedDocumentDto | null;
}
