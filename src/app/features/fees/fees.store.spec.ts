import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '@ums/shared';
import { APP_CONFIG } from '../../core/config/app-config';
import { readPendingPaymentAttempt } from '../../core/state/payment-session-storage.util';
import { FeesStore } from './fees.store';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenFor(userId: string) {
  const payload = { sub: userId, sid: 'session-1', roles: ['Student'] };
  const base64 = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  return {
    accessToken: `header.${base64}.signature`,
    accessTokenExpiresAt: '2026-01-01T00:15:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
    sessionId: 'session-1',
  };
}

const openInvoice = {
  id: 'inv-1',
  sourceModule: 'Academic',
  sourceReferenceId: 'ref-1',
  feeType: 'Tuition',
  ownerId: 'user-1',
  totalAmount: 500,
  currency: 'BDT',
  status: 'Open',
  createdAt: '2026-01-01T00:00:00Z',
  paidAt: null,
};

describe('FeesStore', () => {
  let store: FeesStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  function flushInitialLoad(invoices: unknown[] = [openInvoice], receipts: unknown[] = []): void {
    httpMock.expectOne((r) => r.url === `${baseUrl}/api/v1/finance/invoices`).flush(invoices);
    httpMock
      .expectOne(
        (r) => r.url === `${baseUrl}/api/v1/documents` && r.params.get('type') === 'Receipt',
      )
      .flush(receipts);
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 60_000 } },
      ],
    });
    store = TestBed.inject(FeesStore);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setTokens(tokenFor('user-1'));
  });

  afterEach(() => {
    store.stopPolling();
    httpMock.verify();
    sessionStorage.clear();
  });

  it('starts idle with no invoices', () => {
    expect(store.loading()).toBeFalse();
    expect(store.invoices()).toEqual([]);
    expect(store.dispatchUnconfirmed()).toBeFalse();
  });

  it('loads invoices and receipts, computing outstanding balance', () => {
    store.load();
    flushInitialLoad();

    expect(store.loading()).toBeFalse();
    expect(store.outstandingInvoices().length).toBe(1);
    expect(store.outstandingBalance()).toBe(500);
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('maps receipts to their originating paymentId via sourceReferenceId', () => {
    store.load();
    flushInitialLoad(
      [openInvoice],
      [
        {
          id: 'doc-1',
          sourceReferenceId: 'pay-1',
          status: 'Ready',
          downloadUrl: 'https://x/r.pdf',
        },
      ],
    );

    expect(store.receipts().length).toBe(1);
    expect(store.receipts()[0].paymentId).toBe('pay-1');
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      store.load();
      flushInitialLoad();
      store.selectInvoiceForPayment(openInvoice as never);
    });

    it('persists the idempotency key/invoice/amount to sessionStorage before dispatching', () => {
      store.initiatePayment();
      // Written synchronously, before the HTTP response is even flushed.
      const pending = readPendingPaymentAttempt('fees');
      expect(pending?.invoiceId).toBe('inv-1');
      expect(pending?.amount).toBe(500);
      expect(pending?.paymentId).toBeNull();
      expect(store.submitting()).toBeTrue();

      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments`)
        .flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: 'https://gw/pay' });
    });

    it('sends the Idempotency-Key header, never a body field', () => {
      store.initiatePayment();
      const req = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(req.request.body).toEqual({ invoiceId: 'inv-1' });
      req.flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: 'https://gw/pay' });
    });

    it('updates the persisted attempt with the real paymentId on a successful response and starts polling', async () => {
      store.initiatePayment();
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments`)
        .flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: 'https://gw/pay' });

      expect(readPendingPaymentAttempt('fees')?.paymentId).toBe('pay-1');
      expect(store.submitting()).toBeFalse();
      expect(store.redirectUrl()).toBe('https://gw/pay');

      await wait(10);
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments/pay-1`)
        .flush({ id: 'pay-1', status: 'Successful' });

      expect(store.paymentStatus()?.status).toBe('Successful');
      expect(readPendingPaymentAttempt('fees')).toBeNull();

      // A confirmed terminal status triggers a reload of invoices/receipts.
      httpMock
        .expectOne((r) => r.url === `${baseUrl}/api/v1/finance/invoices`)
        .flush([{ ...openInvoice, status: 'Paid', paidAt: '2026-01-02T00:00:00Z' }]);
      httpMock
        .expectOne(
          (r) => r.url === `${baseUrl}/api/v1/documents` && r.params.get('type') === 'Receipt',
        )
        .flush([]);
    });

    it('clears the pending attempt on a Failed terminal status without reloading invoices', async () => {
      store.initiatePayment();
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments`)
        .flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: 'https://gw/pay' });

      await wait(10);
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments/pay-1`)
        .flush({ id: 'pay-1', status: 'Failed' });

      expect(store.paymentStatus()?.status).toBe('Failed');
      expect(readPendingPaymentAttempt('fees')).toBeNull();
      expect(store.hasBlockingAttempt()).toBeFalse();
    });

    it('clears the pending attempt on a definite server rejection (non-zero status)', () => {
      store.initiatePayment();
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments`)
        .flush({ title: 'Rejected' }, { status: 409, statusText: 'Conflict' });

      expect(readPendingPaymentAttempt('fees')).toBeNull();
      expect(store.paymentError()).toBeTruthy();
      expect(store.submitting()).toBeFalse();
    });

    it('keeps the pending attempt and surfaces dispatchUnconfirmed on a true network drop (status 0)', () => {
      store.initiatePayment();
      const req = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(readPendingPaymentAttempt('fees')).not.toBeNull();
      expect(store.dispatchUnconfirmed()).toBeTrue();
      expect(store.submitting()).toBeFalse();
    });

    it('acknowledgePendingDispatchResolved clears the unconfirmed pending state', () => {
      store.initiatePayment();
      const req = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      expect(store.dispatchUnconfirmed()).toBeTrue();

      store.acknowledgePendingDispatchResolved();
      expect(store.dispatchUnconfirmed()).toBeFalse();
      expect(readPendingPaymentAttempt('fees')).toBeNull();
    });

    it('does not dispatch a second payment while one is already in flight (submitting)', () => {
      store.initiatePayment();
      const firstReq = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);

      store.initiatePayment();
      httpMock.expectNone(`${baseUrl}/api/v1/finance/payments`); // no second POST was queued

      firstReq.flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: null });
      expect(store.submitting()).toBeFalse();
    });

    it('refuses to initiate a payment while offline (Invariant SS8.3), dispatching no request', () => {
      window.dispatchEvent(new Event('offline'));

      store.initiatePayment();

      expect(store.paymentError()).toBe('fees.payment.offline');
      expect(readPendingPaymentAttempt('fees')).toBeNull();
      httpMock.expectNone(`${baseUrl}/api/v1/finance/payments`);
    });
  });

  it('resumes a persisted in-flight attempt on load and polls its status', async () => {
    // Simulate a reload: a previous session already wrote a pending attempt with a known paymentId.
    sessionStorage.setItem(
      'ums-student-web:fees:pending-payment',
      JSON.stringify({
        idempotencyKey: 'key-1',
        invoiceId: 'inv-1',
        amount: 500,
        currency: 'BDT',
        paymentId: 'pay-1',
      }),
    );

    store.load();
    flushInitialLoad();

    expect(store.hasBlockingAttempt()).toBeTrue();
    expect(store.selectedInvoice()?.id).toBe('inv-1');

    await wait(10);
    httpMock
      .expectOne(`${baseUrl}/api/v1/finance/payments/pay-1`)
      .flush({ id: 'pay-1', status: 'Pending' });

    expect(store.paymentStatus()?.status).toBe('Pending');
    expect(store.hasBlockingAttempt()).toBeTrue();
  });

  it('resumes a dispatch-unconfirmed attempt (no paymentId) on load without polling anything', () => {
    sessionStorage.setItem(
      'ums-student-web:fees:pending-payment',
      JSON.stringify({
        idempotencyKey: 'key-1',
        invoiceId: 'inv-1',
        amount: 500,
        currency: 'BDT',
        paymentId: null,
      }),
    );

    store.load();
    flushInitialLoad();

    expect(store.dispatchUnconfirmed()).toBeTrue();
    expect(store.hasBlockingAttempt()).toBeTrue();
    httpMock.expectNone(`${baseUrl}/api/v1/finance/payments/null`);
  });
});
