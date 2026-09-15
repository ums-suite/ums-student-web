import { Injectable, computed, inject, signal } from '@angular/core';
import type { UmsApiError } from '@ums/shared';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StudentApi } from '../../core/api/student.api';
import type {
  StudentRequestDto,
  StudentRequestType,
  SubmitStudentRequestRequest,
} from '../../core/api/student.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import {
  addTrackedRequestId,
  readTrackedRequestIds,
} from '../../core/state/student-request-tracking.util';

const TRACKED_REQUEST_TYPES: readonly StudentRequestType[] = [
  'IdReissue',
  'TranscriptRequest',
  'Grievance',
];

/**
 * StudentRequests store (SWEB-28, requirement-spec.md §3.8). **Confirmed gap**: no "list my
 * StudentRequests" endpoint exists at all (`student.api.ts` doc, only get-by-id and an internal
 * dedup check) -- this store tracks every request id it creates across all three types in
 * `localStorage` (`core/state/student-request-tracking.util.ts`), the exact same mechanism
 * `RegistrationStore` uses for its own "no list my enrollments" gap.
 *
 * Shares its tracking storage with `ResultsStore`'s own `TranscriptRequest` sub-flow (SWEB-19) by
 * design (same `(studentId, requestType)` key) -- a transcript PDF requested from the Grades
 * screen also appears here, and vice versa, since they are genuinely the same underlying
 * `StudentRequest`.
 */
@Injectable({ providedIn: 'root' })
export class RequestsStore {
  private readonly studentApi = inject(StudentApi);
  private readonly connectivity = inject(ConnectivityService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly studentIdState = signal<string | null>(null);
  private readonly requestsState = signal<readonly StudentRequestDto[]>([]);
  private readonly submittingState = signal(false);
  private readonly submitErrorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly submitError = this.submitErrorState.asReadonly();

  /** Newest first. */
  readonly requests = computed(() =>
    [...this.requestsState()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  );

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    this.studentApi.getMyProfile().subscribe({
      next: (student) => {
        this.studentIdState.set(student.id);
        const ids = TRACKED_REQUEST_TYPES.flatMap((type) =>
          readTrackedRequestIds(student.id, type),
        );

        if (ids.length === 0) {
          this.requestsState.set([]);
          this.loadingState.set(false);
          return;
        }

        forkJoin(
          ids.map((id) => this.studentApi.getStudentRequest(id).pipe(catchError(() => of(null)))),
        ).subscribe((results) => {
          this.requestsState.set(results.filter((r): r is StudentRequestDto => r !== null));
          this.loadingState.set(false);
        });
      },
      error: (error: UmsApiError) => {
        this.loadingState.set(false);
        this.errorState.set(error.message || 'requests.error');
      },
    });
  }

  submit(type: StudentRequestType, fields: Omit<SubmitStudentRequestRequest, 'requestType'>): void {
    const studentId = this.studentIdState();
    if (!studentId || this.submittingState()) {
      return;
    }
    if (!this.connectivity.isOnline()) {
      this.submitErrorState.set('requests.offline');
      return;
    }

    this.submittingState.set(true);
    this.submitErrorState.set(null);

    this.studentApi.submitStudentRequest({ requestType: type, ...fields }).subscribe({
      next: (request) => {
        addTrackedRequestId(studentId, type, request.id);
        this.submittingState.set(false);
        this.load();
      },
      error: (error: UmsApiError) => {
        this.submittingState.set(false);
        this.submitErrorState.set(error.message || 'requests.submit.error');
      },
    });
  }
}
