import { Injectable, computed, inject, signal } from '@angular/core';
import { CurrentUserService, type UmsApiError } from '@ums/shared';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocumentsApi } from '../../core/api/documents.api';
import { FinanceApi } from '../../core/api/finance.api';
import type { InvoiceDto, PaymentDto } from '../../core/api/finance.types';
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
import {
  generateIdempotencyKey,
  isConfirmedPaymentStatus,
  isTerminalPaymentStatus,
} from './payment-idempotency';
import type { ReceiptEntry } from './fees.types';

/**
 * Fees store (SWEB-20/21/22, requirement-spec.md §3.5). Invariant §8.3 ("Money-moving actions
 * never queue offline") governs every mutating method here: {@link initiatePayment} refuses
 * outright while offline, never silently defers.
 *
 * **The idempotency-key/pending-attempt lifecycle is this store's single most load-bearing
 * mechanism** (design-decisions.md "Payment Idempotency-Key Persistence", edge-cases.md
 * "Fee-Payment Idempotency Key Survives a Network Drop Between Submit and Response"): the key,
 * invoice id, and amount are written to `sessionStorage` **before** the `POST /finance/payments`
 * call is even dispatched, and only cleared once a genuinely terminal `PaymentStatus` is observed.
 * On {@link load}, any persisted pending attempt is resumed automatically, so a reload after a
 * network drop never re-renders a fresh, enabled "Pay Now" for the same invoice.
 *
 * **A harder, confirmed gap this store is honest about**: there is no "get payment status by
 * idempotency key" endpoint (`finance.api.ts` doc) -- if the initiating POST itself never receives
 * any response at all (a true network drop, surfaced as a client-side `status: 0` error, as
 * opposed to a definite 4xx/5xx the server actually returned), this store has no id to resume
 * polling with. Rather than silently dropping the persisted attempt (which could let the student
 * pay twice) or fabricating a fake "checking..." state that can never resolve, {@link
 * dispatchUnconfirmed} surfaces this exact, narrow case honestly, and only a student's own
 * explicit acknowledgement ({@link acknowledgePendingDispatchResolved}) clears it.
 */
@Injectable({ providedIn: 'root' })
export class FeesStore {
  private readonly financeApi = inject(FinanceApi);
  private readonly documentsApi = inject(DocumentsApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);
  private readonly appConfig = inject(APP_CONFIG);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly invoicesState = signal<readonly InvoiceDto[]>([]);
  private readonly receiptsState = signal<readonly ReceiptEntry[]>([]);
  private readonly fetchedAtState = signal<number | null>(null);

  private readonly selectedInvoiceState = signal<InvoiceDto | null>(null);
  private readonly pendingAttemptState = signal<PendingPaymentAttempt | null>(null);
  private readonly paymentStatusState = signal<PaymentDto | null>(null);
  private readonly submittingState = signal(false);
  private readonly redirectUrlState = signal<string | null>(null);
  private readonly paymentErrorState = signal<string | null>(null);

  private pollSubscription: Subscription | null = null;

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly invoices = this.invoicesState.asReadonly();
  readonly receipts = this.receiptsState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  readonly outstandingInvoices = computed(() =>
    this.invoicesState().filter((invoice) => invoice.status === 'Open'),
  );
  readonly outstandingBalance = computed(() =>
    this.outstandingInvoices().reduce((sum, invoice) => sum + invoice.totalAmount, 0),
  );

  readonly selectedInvoice = this.selectedInvoiceState.asReadonly();
  readonly paymentStatus = this.paymentStatusState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly redirectUrl = this.redirectUrlState.asReadonly();
  readonly paymentError = this.paymentErrorState.asReadonly();

  /** True while a persisted pending attempt exists but was never confirmed to have even reached the server -- see class doc. */
  readonly dispatchUnconfirmed = computed(() => {
    const pending = this.pendingAttemptState();
    return pending !== null && pending.paymentId === null;
  });

  /** True whenever a resumed or in-flight attempt should block a fresh "Pay Now" for the same invoice. */
  readonly hasBlockingAttempt = computed(() => {
    const pending = this.pendingAttemptState();
    if (!pending) {
      return false;
    }
    if (pending.paymentId === null) {
      return true;
    }
    const status = this.paymentStatusState();
    return !status || !isTerminalPaymentStatus(status.status);
  });

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    const ownerId = this.currentUser.userId();

    if (!ownerId) {
      this.loadingState.set(false);
      this.errorState.set('fees.error');
      return;
    }

    forkJoin({
      invoices: this.financeApi
        .listMyInvoices(ownerId)
        .pipe(catchError(() => of<InvoiceDto[]>([]))),
      receipts: this.documentsApi
        .listMyDocuments(ownerId, 'Receipt')
        .pipe(catchError(() => of([]))),
    }).subscribe(({ invoices, receipts }) => {
      this.invoicesState.set(invoices);
      this.receiptsState.set(
        receipts.map((document) => ({ paymentId: document.sourceReferenceId, document })),
      );
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
      this.resumePendingAttempt(invoices);
    });
  }

  private resumePendingAttempt(invoices: readonly InvoiceDto[]): void {
    const pending = readPendingPaymentAttempt('fees');
    this.pendingAttemptState.set(pending);
    if (!pending) {
      return;
    }

    const matchingInvoice = invoices.find((invoice) => invoice.id === pending.invoiceId) ?? null;
    this.selectedInvoiceState.set(matchingInvoice);

    if (pending.paymentId) {
      this.startPolling(pending.paymentId);
    }
  }

  selectInvoiceForPayment(invoice: InvoiceDto): void {
    this.selectedInvoiceState.set(invoice);
    this.paymentErrorState.set(null);
    const pending = this.pendingAttemptState();
    if (!pending || pending.invoiceId !== invoice.id) {
      this.paymentStatusState.set(null);
      this.redirectUrlState.set(null);
    }
  }

  /**
   * SWEB-21. Invariant §8.3: refuses outright while offline. Persists the idempotency key/
   * invoice/amount to `sessionStorage` before dispatching (see class doc) -- the submit control's
   * disabled state ({@link submitting}) is the in-memory half of the same discipline.
   */
  initiatePayment(): void {
    const invoice = this.selectedInvoiceState();
    if (!invoice || this.submittingState() || this.hasBlockingAttempt()) {
      return;
    }

    if (!this.connectivity.isOnline()) {
      this.paymentErrorState.set('fees.payment.offline');
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    const attempt: PendingPaymentAttempt = {
      idempotencyKey,
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      paymentId: null,
    };
    // Written before the request is even dispatched -- design-decisions.md's own explicit rule.
    writePendingPaymentAttempt('fees', attempt);
    this.pendingAttemptState.set(attempt);

    this.submittingState.set(true);
    this.paymentErrorState.set(null);

    this.financeApi.initiatePayment({ invoiceId: invoice.id }, idempotencyKey).subscribe({
      next: ({ payment, redirectUrl }) => {
        this.submittingState.set(false);
        const updated: PendingPaymentAttempt = { ...attempt, paymentId: payment.id };
        writePendingPaymentAttempt('fees', updated);
        this.pendingAttemptState.set(updated);
        this.paymentStatusState.set(payment);
        this.redirectUrlState.set(redirectUrl);
        this.startPolling(payment.id);
      },
      error: (error: UmsApiError) => {
        this.submittingState.set(false);
        if (error.status === 0) {
          // A true network drop -- no response was ever received, so we genuinely cannot tell
          // whether the server processed this. Keep the persisted attempt; dispatchUnconfirmed
          // surfaces the honest state rather than guessing either way.
          return;
        }
        // A definite server-returned rejection -- safe to clear, the server never started a Payment.
        clearPendingPaymentAttempt('fees');
        this.pendingAttemptState.set(null);
        this.paymentErrorState.set(error.message || 'fees.payment.error');
      },
    });
  }

  /** The student's own explicit acknowledgement of the {@link dispatchUnconfirmed} case (see class doc) -- never inferred automatically. */
  acknowledgePendingDispatchResolved(): void {
    clearPendingPaymentAttempt('fees');
    this.pendingAttemptState.set(null);
    this.paymentStatusState.set(null);
    this.redirectUrlState.set(null);
  }

  private startPolling(paymentId: string): void {
    this.stopPolling();
    this.pollSubscription = shortPoll(
      () => this.financeApi.getPayment(paymentId),
      this.appConfig.pollIntervalMs,
    ).subscribe((payment) => {
      this.paymentStatusState.set(payment);
      if (isTerminalPaymentStatus(payment.status)) {
        this.stopPolling();
        clearPendingPaymentAttempt('fees');
        this.pendingAttemptState.set(null);
        if (isConfirmedPaymentStatus(payment.status)) {
          this.load();
        }
      }
    });
  }

  stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
