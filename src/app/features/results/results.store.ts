import { Injectable, computed, inject, signal } from '@angular/core';
import type { UmsApiError } from '@ums/shared';
import { catchError, forkJoin, of } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { CourseDto, TranscriptDto } from '../../core/api/academic.types';
import { DocumentsApi } from '../../core/api/documents.api';
import type { GeneratedDocumentDto } from '../../core/api/documents.types';
import { StudentApi } from '../../core/api/student.api';
import type { StudentRequestStatus } from '../../core/api/student.types';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import {
  addTrackedRequestId,
  readTrackedRequestIds,
} from '../../core/state/student-request-tracking.util';
import { buildGpaTrendPoints, buildSemesterGroups } from './results.logic';

/**
 * Results store (SWEB-17/18/19, requirement-spec.md §3.4). **Invariant §8.1 is the single most
 * load-bearing rule in this file**: every `Grade`/`StudentResultRowDto` this store ever holds is
 * Published-only *by construction*, server-side -- `AcademicApi.getMyTranscript`/
 * `getMyPublishedResults` both hit `StudentResultQueryService` methods that filter to
 * `ResultPublicationStatus.Published` per-row before returning anything (confirmed by direct
 * source inspection, not assumed). This store never re-derives, caches independently of, or
 * second-guesses that filter -- there is no client-side "is this published" check anywhere here
 * because the one and only data source already guarantees it, under every code path (no
 * prefetch, no optimistic write, nothing else reads/writes `transcript` in this store).
 *
 * **Invariant §8.4** ("GPA/CGPA is never client-recomputed as authoritative"): the only
 * authoritative figure this store exposes is {@link overallAverageScore}, taken verbatim from
 * `TranscriptDto.overallAverageScore`. {@link semesterGroups}/{@link gpaTrendPoints} are a
 * client-computed, explicitly unofficial per-semester preview -- see `results.logic.ts`'s own doc
 * for why (confirmed gap: no per-semester GPA exists server-side at all).
 *
 * Reconciles on reconnect, not merely on foreground (design-decisions.md "Offline-Cache
 * Reconciliation Trigger" -- named explicitly for this store: "force-refreshes the Dashboard
 * attention panel and Results store"), so a result published while this device was offline is
 * caught the instant connectivity returns (edge-cases.md "Published Result Notification Arrives
 * While an Offline-Cached Dashboard Is Open").
 */
@Injectable({ providedIn: 'root' })
export class ResultsStore {
  private readonly studentApi = inject(StudentApi);
  private readonly academicApi = inject(AcademicApi);
  private readonly documentsApi = inject(DocumentsApi);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly transcriptState = signal<TranscriptDto | null>(null);
  private readonly studentIdState = signal<string | null>(null);
  private readonly fetchedAtState = signal<number | null>(null);
  /** courseId -> resolved `CourseDto` (code/title display only) -- `StudentResultRowDto` itself only carries a raw `courseId`. Best-effort: a course that fails to resolve simply renders its id, never blocks the rest of the transcript. */
  private readonly courseInfoState = signal<ReadonlyMap<string, CourseDto>>(new Map());

  private readonly transcriptPdfRequestIdState = signal<string | null>(null);
  private readonly transcriptPdfStatusState = signal<StudentRequestStatus | null>(null);
  private readonly transcriptPdfDocumentState = signal<GeneratedDocumentDto | null>(null);
  private readonly transcriptPdfSubmittingState = signal(false);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  /** The one, sole, authoritative CGPA-equivalent figure (Invariant §8.4) -- `null` until a transcript with at least one published result exists. */
  readonly overallAverageScore = computed(
    () => this.transcriptState()?.overallAverageScore ?? null,
  );

  /** SWEB-17: per-semester published `Grade` groups -- see class doc, every row already Published-only. */
  readonly semesterGroups = computed(() =>
    buildSemesterGroups(this.transcriptState()?.results ?? []),
  );

  /** SWEB-18: one unofficial-preview trend point per semester, in chronological order. */
  readonly gpaTrendPoints = computed(() => buildGpaTrendPoints(this.semesterGroups()));

  readonly hasAnyPublishedResults = computed(() => this.semesterGroups().length > 0);
  readonly courseInfo = this.courseInfoState.asReadonly();

  readonly transcriptPdfRequestId = this.transcriptPdfRequestIdState.asReadonly();
  readonly transcriptPdfStatus = this.transcriptPdfStatusState.asReadonly();
  readonly transcriptPdfDocument = this.transcriptPdfDocumentState.asReadonly();
  readonly transcriptPdfSubmitting = this.transcriptPdfSubmittingState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    this.studentApi.getMyProfile().subscribe({
      next: (student) => {
        this.studentIdState.set(student.id);
        this.resumeTrackedTranscriptRequest(student.id);

        this.academicApi.getMyTranscript(student.id).subscribe({
          next: (transcript) => {
            this.transcriptState.set(transcript);
            this.loadingState.set(false);
            this.fetchedAtState.set(Date.now());
            this.resolveCourseInfo(transcript);
          },
          error: (error: UmsApiError) => {
            this.loadingState.set(false);
            this.errorState.set(error.message || 'results.error');
          },
        });
      },
      error: (error: UmsApiError) => {
        this.loadingState.set(false);
        this.errorState.set(error.message || 'results.error');
      },
    });
  }

  private resolveCourseInfo(transcript: TranscriptDto): void {
    const uniqueCourseIds = Array.from(new Set(transcript.results.map((r) => r.courseId)));
    if (uniqueCourseIds.length === 0) {
      this.courseInfoState.set(new Map());
      return;
    }

    forkJoin(
      uniqueCourseIds.map((id) => this.academicApi.getCourse(id).pipe(catchError(() => of(null)))),
    ).subscribe((courses) => {
      const map = new Map<string, CourseDto>();
      courses.forEach((course, index) => {
        if (course) {
          map.set(uniqueCourseIds[index], course);
        }
      });
      this.courseInfoState.set(map);
    });
  }

  private resumeTrackedTranscriptRequest(studentId: string): void {
    const ids = readTrackedRequestIds(studentId, 'TranscriptRequest');
    const latestId = ids.length > 0 ? ids[ids.length - 1] : null;
    this.transcriptPdfRequestIdState.set(latestId);
    if (latestId) {
      this.refreshTranscriptPdfStatus(latestId);
    }
  }

  /**
   * SWEB-19: submits a `TranscriptRequest`-type `StudentRequest` -- the only real path to a PDF
   * (see class/`results.types.ts` doc, no direct self-serve generation endpoint exists).
   * `localePreferenceNote` is recorded but, per the confirmed gap, has no effect on the rendered
   * PDF's language today.
   */
  requestTranscriptPdf(localePreferenceNote: string): void {
    const studentId = this.studentIdState();
    if (!studentId || this.transcriptPdfSubmittingState()) {
      return;
    }

    this.transcriptPdfSubmittingState.set(true);
    this.studentApi
      .submitStudentRequest({
        requestType: 'TranscriptRequest',
        reason: null,
        purpose: localePreferenceNote,
        description: null,
        isAgainstOwnDepartmentHead: false,
      })
      .subscribe({
        next: (request) => {
          addTrackedRequestId(studentId, 'TranscriptRequest', request.id);
          this.transcriptPdfRequestIdState.set(request.id);
          this.transcriptPdfStatusState.set(request.status);
          this.transcriptPdfSubmittingState.set(false);
        },
        error: () => this.transcriptPdfSubmittingState.set(false),
      });
  }

  /** Re-fetches the tracked request's status, resolving the `GeneratedDocument` once approval fulfills it. */
  refreshTranscriptPdfStatus(requestId?: string): void {
    const id = requestId ?? this.transcriptPdfRequestIdState();
    if (!id) {
      return;
    }

    this.studentApi.getStudentRequest(id).subscribe({
      next: (request) => {
        this.transcriptPdfStatusState.set(request.status);
        if (request.generatedDocumentId) {
          this.documentsApi.getDocument(request.generatedDocumentId).subscribe({
            next: (document) => this.transcriptPdfDocumentState.set(document),
            error: () => undefined,
          });
        }
      },
      error: () => undefined,
    });
  }
}
