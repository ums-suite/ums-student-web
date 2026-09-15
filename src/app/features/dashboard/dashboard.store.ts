import { Injectable, inject, signal } from '@angular/core';
import { CurrentUserService, type UmsApiError } from '@ums/shared';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { ProgramDto, TranscriptDto } from '../../core/api/academic.types';
import { FinanceApi } from '../../core/api/finance.api';
import type { InvoiceDto } from '../../core/api/finance.types';
import { HostelApi } from '../../core/api/hostel.api';
import { NON_TERMINAL_ALLOCATION_STATUSES, type AllocationDto } from '../../core/api/hostel.types';
import { StudentApi } from '../../core/api/student.api';
import type { StudentDto } from '../../core/api/student.types';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { NotificationChannelService } from '../../core/realtime/notification-channel.service';
import {
  buildAttentionItems,
  buildSemesterScoreTrend,
  sumOutstandingBalance,
} from './dashboard.logic';
import type { DashboardSnapshot } from './dashboard.types';

/**
 * Dashboard store (SWEB-9/SWEB-10, requirement-spec.md §3.1).
 *
 * **No backend dashboard-summary/aggregate endpoint exists** (confirmed gap) -- this store
 * composes its snapshot from four independent module reads (Student profile, Academic program +
 * transcript, Finance invoices, Hostel allocation). The Student profile fetch is the only one
 * treated as fatal to the whole dashboard; every other read degrades gracefully (`null`/`[]`) on
 * its own failure so one module being briefly unavailable never blanks the entire screen --
 * matching the platform's "gorgeous, resilient" bar (requirement-spec.md §7) over an
 * all-or-nothing error state.
 *
 * Also **no current-semester-for-student concept exists server-side** -- the "registration window
 * open" attention item (§3.1) is therefore not populated from this store; Registration's own
 * screen (SWEB-11) is the authoritative place a student discovers an open window today.
 *
 * Reconciles on reconnect, not merely on foreground (design-decisions.md "Offline-Cache
 * Reconciliation Trigger"), and exposes `fetchedAt` so the shell can render a "last updated"
 * staleness indicator while offline (§9 "Offline access to a previously-loaded screen").
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly studentApi = inject(StudentApi);
  private readonly academicApi = inject(AcademicApi);
  private readonly financeApi = inject(FinanceApi);
  private readonly hostelApi = inject(HostelApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly notificationChannel = inject(NotificationChannelService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly snapshotState = signal<DashboardSnapshot | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly snapshot = this.snapshotState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    this.studentApi.getMyProfile().subscribe({
      next: (student) => this.loadDependentData(student),
      error: (error: UmsApiError) => {
        this.loadingState.set(false);
        this.errorState.set(error.message || 'dashboard.error');
      },
    });
  }

  private loadDependentData(student: StudentDto): void {
    const userId = this.currentUser.userId();

    forkJoin({
      program: this.academicApi
        .getProgram(student.programId)
        .pipe(catchError(() => of<ProgramDto | null>(null))),
      invoices: userId
        ? this.financeApi.listMyInvoices(userId).pipe(catchError(() => of<InvoiceDto[]>([])))
        : of<InvoiceDto[]>([]),
      allocation: this.hostelApi.getMyAllocations().pipe(
        map(
          (allocations) =>
            allocations.find((a) => NON_TERMINAL_ALLOCATION_STATUSES.has(a.status)) ?? null,
        ),
        catchError(() => of<AllocationDto | null>(null)),
      ),
      transcript: this.academicApi
        .getMyTranscript(student.id)
        .pipe(
          catchError(() =>
            of<TranscriptDto>({ studentId: student.id, results: [], overallAverageScore: null }),
          ),
        ),
    }).subscribe(({ program, invoices, allocation, transcript }) => {
      const outstandingBalance = sumOutstandingBalance(invoices);
      const attentionItems = buildAttentionItems({
        outstandingBalance,
        currencyCode: invoices[0]?.currency ?? null,
        unreadNotificationCount: this.notificationChannel.unreadCount(),
        registrationWindowOpen: false,
      });

      this.snapshotState.set({
        student,
        program,
        outstandingInvoices: invoices.filter((invoice) => invoice.status === 'Open'),
        outstandingBalance,
        currencyCode: invoices[0]?.currency ?? null,
        allocation,
        overallAverageScore: transcript.overallAverageScore,
        semesterScoreTrend: buildSemesterScoreTrend(transcript.results),
        attentionItems,
        fetchedAt: Date.now(),
      });
      this.loadingState.set(false);
    });
  }
}
