import { Injectable, computed, inject, signal } from '@angular/core';
import type { UmsApiError } from '@ums/shared';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FinanceApi } from '../../core/api/finance.api';
import type { InvoiceDto, PaymentDto } from '../../core/api/finance.types';
import { HostelApi } from '../../core/api/hostel.api';
import {
  NON_TERMINAL_ALLOCATION_STATUSES,
  type AllocationDto,
  type ApplicationWindowDto,
  type ComplaintCategory,
  type ComplaintDto,
  type HostelApplicationDto,
  type HostelDto,
} from '../../core/api/hostel.types';
import { APP_CONFIG } from '../../core/config/app-config';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { shortPoll } from '../../core/realtime/short-poll';
import {
  type PendingPaymentAttempt,
  clearPendingPaymentAttempt,
  readPendingPaymentAttempt,
  writePendingPaymentAttempt,
} from '../../core/state/payment-session-storage.util';
import { generateIdempotencyKey } from '../../core/util/idempotency-key.util';
import { isConfirmedPaymentStatus, isTerminalPaymentStatus } from '../fees/payment-idempotency';
import {
  addPreference,
  movePreferenceDown,
  movePreferenceUp,
  toPreferenceDtos,
} from './hostel.logic';
import type { PreferenceDraftEntry } from './hostel.types';

const HOSTEL_FEE_PAYMENT_NAMESPACE = 'hostel-fee';

/**
 * Hostel store (SWEB-23/24/25, requirement-spec.md §3.6). Invariant §8.6 ("Hostel `Allocation` is
 * one-active-per-student") governs {@link activeAllocation}: it is the single non-terminal
 * (`Pending`/`FeePaid`/`Active`) row among {@link allocations} (a real DB-enforced partial unique
 * index server-side, confirmed against `AllocationConfiguration.cs`) -- the UI never presents a
 * flow implying a second concurrent application/allocation while this is non-null.
 *
 * **Confirmed gap**: no bed/room occupancy endpoint exists (`hostel.types.ts` `RoomDto` doc) --
 * the visual picker (SWEB-23) can browse real Hostel/Building/Room inventory but cannot show true
 * availability. It also cannot pick a specific room/bed at all: `CreateHostelApplicationRequest`
 * only ever accepts a ranked list of `(hostelId, preferredRoomType)` preferences -- a specific bed
 * is chosen automatically server-side at approval time (confirmed against
 * `AllocationService.FindAndLockAvailableBedAsync`).
 *
 * **design-decisions.md "Hostel-Fee Payment Screen Re-Validates Allocation State"**:
 * {@link initiateHostelFeePayment} always re-fetches `getMyAllocations()` and compares the fresh
 * row against what's displayed before dispatching payment -- a mismatch blocks submission with
 * {@link allocationMismatchNotice} rather than silently paying against stale data.
 *
 * Hostel fee payment reuses SWEB-21's exact idempotency-key/sessionStorage-persistence mechanism
 * (`core/state/payment-session-storage.util.ts`), namespaced `'hostel-fee'` so it never collides
 * with Fees' own general invoice-payment slot.
 */
@Injectable({ providedIn: 'root' })
export class HostelStore {
  private readonly hostelApi = inject(HostelApi);
  private readonly financeApi = inject(FinanceApi);
  private readonly connectivity = inject(ConnectivityService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);
  private readonly appConfig = inject(APP_CONFIG);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly fetchedAtState = signal<number | null>(null);

  private readonly applicationWindowsState = signal<readonly ApplicationWindowDto[]>([]);
  private readonly selectedWindowState = signal<ApplicationWindowDto | null>(null);
  private readonly hostelsState = signal<readonly HostelDto[]>([]);
  private readonly applicationsState = signal<readonly HostelApplicationDto[]>([]);
  private readonly allocationsState = signal<readonly AllocationDto[]>([]);
  private readonly complaintsState = signal<readonly ComplaintDto[]>([]);

  private readonly preferenceDraftState = signal<readonly PreferenceDraftEntry[]>([]);
  private readonly applyErrorState = signal<string | null>(null);
  private readonly submittingApplicationState = signal(false);

  private readonly selectedAllocationForPaymentState = signal<AllocationDto | null>(null);
  private readonly hostelFeeInvoiceState = signal<InvoiceDto | null>(null);
  private readonly allocationMismatchNoticeState = signal<string | null>(null);
  private readonly hostelPendingAttemptState = signal<PendingPaymentAttempt | null>(null);
  private readonly hostelPaymentStatusState = signal<PaymentDto | null>(null);
  private readonly hostelPaymentSubmittingState = signal(false);
  private readonly hostelPaymentErrorState = signal<string | null>(null);
  private readonly hostelRedirectUrlState = signal<string | null>(null);

  private readonly complaintSubmittingState = signal(false);
  private readonly complaintErrorState = signal<string | null>(null);

  private hostelPollSubscription: Subscription | null = null;

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  readonly applicationWindows = this.applicationWindowsState.asReadonly();
  readonly selectedWindow = this.selectedWindowState.asReadonly();
  readonly hostels = this.hostelsState.asReadonly();
  readonly applications = this.applicationsState.asReadonly();
  readonly allocations = this.allocationsState.asReadonly();
  readonly complaints = this.complaintsState.asReadonly();

  /** Invariant §8.6: the single non-terminal Allocation, if any. */
  readonly activeAllocation = computed(
    () =>
      this.allocationsState().find((a) => NON_TERMINAL_ALLOCATION_STATUSES.has(a.status)) ?? null,
  );

  readonly preferenceDraft = this.preferenceDraftState.asReadonly();
  readonly applyError = this.applyErrorState.asReadonly();
  readonly submittingApplication = this.submittingApplicationState.asReadonly();

  readonly selectedAllocationForPayment = this.selectedAllocationForPaymentState.asReadonly();
  readonly hostelFeeInvoice = this.hostelFeeInvoiceState.asReadonly();
  readonly allocationMismatchNotice = this.allocationMismatchNoticeState.asReadonly();
  readonly hostelPaymentStatus = this.hostelPaymentStatusState.asReadonly();
  readonly hostelPaymentSubmitting = this.hostelPaymentSubmittingState.asReadonly();
  readonly hostelPaymentError = this.hostelPaymentErrorState.asReadonly();
  readonly hostelRedirectUrl = this.hostelRedirectUrlState.asReadonly();

  readonly hostelDispatchUnconfirmed = computed(() => {
    const pending = this.hostelPendingAttemptState();
    return pending !== null && pending.paymentId === null;
  });

  readonly hostelPaymentBlocking = computed(() => {
    const pending = this.hostelPendingAttemptState();
    if (!pending) {
      return false;
    }
    if (pending.paymentId === null) {
      return true;
    }
    const status = this.hostelPaymentStatusState();
    return !status || !isTerminalPaymentStatus(status.status);
  });

  readonly complaintSubmitting = this.complaintSubmittingState.asReadonly();
  readonly complaintError = this.complaintErrorState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    forkJoin({
      windows: this.hostelApi
        .listApplicationWindows()
        .pipe(catchError(() => of<ApplicationWindowDto[]>([]))),
      hostels: this.hostelApi.listHostels().pipe(catchError(() => of<HostelDto[]>([]))),
      applications: this.hostelApi
        .getMyApplications()
        .pipe(catchError(() => of<HostelApplicationDto[]>([]))),
      allocations: this.hostelApi
        .getMyAllocations()
        .pipe(catchError(() => of<AllocationDto[]>([]))),
      complaints: this.hostelApi.getMyComplaints().pipe(catchError(() => of<ComplaintDto[]>([]))),
    }).subscribe(({ windows, hostels, applications, allocations, complaints }) => {
      this.applicationWindowsState.set(windows);
      this.hostelsState.set(hostels);
      this.applicationsState.set(applications);
      this.allocationsState.set(allocations);
      this.complaintsState.set(complaints);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
      this.resumeHostelFeeAttempt(allocations);
    });
  }

  selectWindow(window: ApplicationWindowDto): void {
    this.selectedWindowState.set(window);
    this.preferenceDraftState.set([]);
    this.applyErrorState.set(null);
  }

  addPreferenceToDraft(entry: PreferenceDraftEntry): void {
    this.preferenceDraftState.update((list) => addPreference(list, entry));
  }

  removePreferenceFromDraft(index: number): void {
    this.preferenceDraftState.update((list) => list.filter((_, i) => i !== index));
  }

  movePreferenceUp(index: number): void {
    this.preferenceDraftState.update((list) => movePreferenceUp(list, index));
  }

  movePreferenceDown(index: number): void {
    this.preferenceDraftState.update((list) => movePreferenceDown(list, index));
  }

  /**
   * SWEB-23. Re-validates at submit time (edge-cases.md "Hostel room preference becomes
   * unavailable between browse and confirm"): re-fetches the window (still open?) and the hostel
   * list (each preferred hostel still exists?) immediately before dispatching. A hostel that
   * disappeared from the fresh list is dropped from the draft and the student is asked to pick a
   * fallback -- never silently substituted.
   */
  submitApplication(input: {
    readonly yearOfStudy: number;
    readonly hasFinancialNeed: boolean;
    readonly homeDistrictDistanceKm: number | null;
  }): void {
    const window = this.selectedWindowState();
    const preferences = this.preferenceDraftState();
    if (!window || preferences.length === 0 || this.submittingApplicationState()) {
      return;
    }
    if (!this.connectivity.isOnline()) {
      this.applyErrorState.set('hostel.apply.offline');
      return;
    }

    this.submittingApplicationState.set(true);
    this.applyErrorState.set(null);

    forkJoin({
      freshWindow: this.hostelApi.getApplicationWindow(window.id).pipe(catchError(() => of(null))),
      freshHostels: this.hostelApi.listHostels().pipe(catchError(() => of<HostelDto[]>([]))),
    }).subscribe(({ freshWindow, freshHostels }) => {
      if (!freshWindow || new Date(freshWindow.closesAt).getTime() < Date.now()) {
        this.submittingApplicationState.set(false);
        this.applyErrorState.set('hostel.apply.windowClosed');
        this.load();
        return;
      }

      const freshHostelIds = new Set(freshHostels.map((h) => h.id));
      const stillValid = preferences.filter((p) => freshHostelIds.has(p.hostelId));
      if (stillValid.length !== preferences.length) {
        this.preferenceDraftState.set(stillValid);
        this.submittingApplicationState.set(false);
        this.applyErrorState.set('hostel.apply.preferenceUnavailable');
        return;
      }

      this.hostelApi
        .submitApplication({
          applicationWindowId: window.id,
          yearOfStudy: input.yearOfStudy,
          hasFinancialNeed: input.hasFinancialNeed,
          homeDistrictDistanceKm: input.homeDistrictDistanceKm,
          preferences: toPreferenceDtos(stillValid),
        })
        .subscribe({
          next: () => {
            this.submittingApplicationState.set(false);
            this.preferenceDraftState.set([]);
            this.load();
          },
          error: (error: UmsApiError) => {
            this.submittingApplicationState.set(false);
            this.applyErrorState.set(error.message || 'hostel.apply.error');
          },
        });
    });
  }

  withdrawApplication(id: string): void {
    if (!this.connectivity.isOnline()) {
      this.applyErrorState.set('hostel.apply.offline');
      return;
    }
    this.hostelApi.withdrawApplication(id).subscribe(() => this.load());
  }

  // -- Hostel fee payment (SWEB-24) --

  private resumeHostelFeeAttempt(allocations: readonly AllocationDto[]): void {
    const pending = readPendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE);
    this.hostelPendingAttemptState.set(pending);
    if (!pending) {
      return;
    }
    const allocation = allocations.find((a) => a.invoiceId === pending.invoiceId) ?? null;
    this.selectedAllocationForPaymentState.set(allocation);
    if (pending.paymentId) {
      this.startHostelPolling(pending.paymentId);
    }
  }

  selectAllocationForPayment(allocation: AllocationDto): void {
    this.selectedAllocationForPaymentState.set(allocation);
    this.allocationMismatchNoticeState.set(null);
    this.hostelPaymentErrorState.set(null);
    this.loadHostelFeeInvoice(allocation);
  }

  /** Refetches the invoice for `allocation` without disturbing an already-set {@link allocationMismatchNotice} -- unlike the public {@link selectAllocationForPayment}, used only by the mismatch-recovery path in {@link initiateHostelFeePayment}. */
  private loadHostelFeeInvoice(allocation: AllocationDto): void {
    if (!allocation.invoiceId) {
      this.hostelFeeInvoiceState.set(null);
      return;
    }
    this.financeApi.getInvoice(allocation.invoiceId).subscribe({
      next: (invoice) => this.hostelFeeInvoiceState.set(invoice),
      error: () => this.hostelFeeInvoiceState.set(null),
    });
  }

  /** design-decisions.md "Hostel-Fee Payment Screen Re-Validates Allocation State" -- see class doc. */
  initiateHostelFeePayment(): void {
    const displayed = this.selectedAllocationForPaymentState();
    const invoice = this.hostelFeeInvoiceState();
    if (
      !displayed ||
      !invoice ||
      this.hostelPaymentSubmittingState() ||
      this.hostelPaymentBlocking()
    ) {
      return;
    }
    if (!this.connectivity.isOnline()) {
      this.hostelPaymentErrorState.set('hostel.payment.offline');
      return;
    }

    this.hostelApi.getMyAllocations().subscribe({
      next: (fresh) => {
        const current = fresh.find((a) => a.id === displayed.id) ?? null;
        if (
          !current ||
          current.status !== displayed.status ||
          current.invoiceId !== displayed.invoiceId
        ) {
          this.allocationMismatchNoticeState.set('hostel.payment.mismatch');
          this.allocationsState.set(fresh);
          this.selectedAllocationForPaymentState.set(current);
          if (current) {
            this.loadHostelFeeInvoice(current);
          }
          return;
        }

        this.dispatchHostelFeePayment(invoice);
      },
      error: () => this.hostelPaymentErrorState.set('hostel.payment.error'),
    });
  }

  private dispatchHostelFeePayment(invoice: InvoiceDto): void {
    const idempotencyKey = generateIdempotencyKey();
    const attempt: PendingPaymentAttempt = {
      idempotencyKey,
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      paymentId: null,
    };
    writePendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE, attempt);
    this.hostelPendingAttemptState.set(attempt);
    this.hostelPaymentSubmittingState.set(true);
    this.hostelPaymentErrorState.set(null);

    this.financeApi.initiatePayment({ invoiceId: invoice.id }, idempotencyKey).subscribe({
      next: ({ payment, redirectUrl }) => {
        this.hostelPaymentSubmittingState.set(false);
        const updated = { ...attempt, paymentId: payment.id };
        writePendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE, updated);
        this.hostelPendingAttemptState.set(updated);
        this.hostelPaymentStatusState.set(payment);
        this.hostelRedirectUrlState.set(redirectUrl);
        this.startHostelPolling(payment.id);
      },
      error: (error: UmsApiError) => {
        this.hostelPaymentSubmittingState.set(false);
        if (error.status === 0) {
          return;
        }
        clearPendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE);
        this.hostelPendingAttemptState.set(null);
        this.hostelPaymentErrorState.set(error.message || 'hostel.payment.error');
      },
    });
  }

  acknowledgeHostelDispatchUnresolved(): void {
    clearPendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE);
    this.hostelPendingAttemptState.set(null);
    this.hostelPaymentStatusState.set(null);
    this.hostelRedirectUrlState.set(null);
  }

  private startHostelPolling(paymentId: string): void {
    this.stopHostelPolling();
    this.hostelPollSubscription = shortPoll(
      () => this.financeApi.getPayment(paymentId),
      this.appConfig.pollIntervalMs,
    ).subscribe((payment) => {
      this.hostelPaymentStatusState.set(payment);
      if (isTerminalPaymentStatus(payment.status)) {
        this.stopHostelPolling();
        clearPendingPaymentAttempt(HOSTEL_FEE_PAYMENT_NAMESPACE);
        this.hostelPendingAttemptState.set(null);
        if (isConfirmedPaymentStatus(payment.status)) {
          this.load();
        }
      }
    });
  }

  stopHostelPolling(): void {
    this.hostelPollSubscription?.unsubscribe();
    this.hostelPollSubscription = null;
  }

  // -- Check-out (SWEB-24). No check-in action exists: check-in is officer-only server-side
  // (`hostel.allocation.checkin` permission, confirmed) -- `Allocation.status` moving to `Active`
  // itself is what "checked in" means here, never a student-triggered action. --

  checkOut(allocationId: string): void {
    if (!this.connectivity.isOnline()) {
      this.applyErrorState.set('hostel.apply.offline');
      return;
    }
    // Self-checkout is always forced to `Voluntary` server-side when the caller owns the
    // Allocation (confirmed in `AllocationEndpoints.cs`) -- the request body value is ignored.
    this.hostelApi
      .checkOut(allocationId, { checkOutType: 'Voluntary' })
      .subscribe(() => this.load());
  }

  // -- Complaints (SWEB-25) --

  submitComplaint(allocationId: string, category: ComplaintCategory, description: string): void {
    if (this.complaintSubmittingState()) {
      return;
    }
    if (!this.connectivity.isOnline()) {
      this.complaintErrorState.set('hostel.complaint.offline');
      return;
    }

    this.complaintSubmittingState.set(true);
    this.complaintErrorState.set(null);

    this.hostelApi
      .submitComplaint({
        allocationId,
        category,
        description,
        idempotencyKey: generateIdempotencyKey(),
      })
      .subscribe({
        next: () => {
          this.complaintSubmittingState.set(false);
          this.load();
        },
        error: (error: UmsApiError) => {
          this.complaintSubmittingState.set(false);
          this.complaintErrorState.set(error.message || 'hostel.complaint.error');
        },
      });
  }
}
