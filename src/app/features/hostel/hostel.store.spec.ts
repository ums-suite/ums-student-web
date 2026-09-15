import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { readPendingPaymentAttempt } from '../../core/state/payment-session-storage.util';
import { HostelStore } from './hostel.store';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const activeWindow = {
  id: 'win-1',
  sessionLabel: 'AY26',
  opensAt: '2020-01-01T00:00:00Z',
  closesAt: '2099-01-01T00:00:00Z',
  eligibleProgramIds: [],
  eligibleYears: [1, 2, 3, 4],
  eligibilityRules: [],
  rulesVersion: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const hostelA = { id: 'h1', name: 'Hostel A', type: 'Mixed', createdAt: '2026-01-01T00:00:00Z' };

const allocation = {
  id: 'alloc-1',
  studentId: 'student-1',
  bedId: 'bed-1',
  roomId: 'room-1',
  hostelId: 'h1',
  hostelApplicationId: 'app-1',
  status: 'Pending',
  invoiceId: 'inv-1',
  feeGraceDeadline: '2099-01-01T00:00:00Z',
  checkOutKind: null,
  refundRequested: false,
  createdAt: '2026-01-01T00:00:00Z',
  feePaidAt: null,
  activatedAt: null,
  checkedOutAt: null,
  expiredAt: null,
};

const hostelInvoice = {
  id: 'inv-1',
  sourceModule: 'Hostel',
  sourceReferenceId: 'alloc-1',
  feeType: 'HostelFee',
  ownerId: 'user-1',
  totalAmount: 3000,
  currency: 'BDT',
  status: 'Open',
  createdAt: '2026-01-01T00:00:00Z',
  paidAt: null,
};

describe('HostelStore', () => {
  let store: HostelStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  function flushInitialLoad(
    overrides: {
      windows?: unknown[];
      hostels?: unknown[];
      applications?: unknown[];
      allocations?: unknown[];
      complaints?: unknown[];
    } = {},
  ): void {
    httpMock
      .expectOne(`${baseUrl}/api/v1/hostel/application-windows`)
      .flush(overrides.windows ?? [activeWindow]);
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels`).flush(overrides.hostels ?? [hostelA]);
    httpMock
      .expectOne(`${baseUrl}/api/v1/hostel/applications/me`)
      .flush(overrides.applications ?? []);
    httpMock
      .expectOne(`${baseUrl}/api/v1/hostel/allocations/me`)
      .flush(overrides.allocations ?? []);
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/complaints/me`).flush(overrides.complaints ?? []);
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
    store = TestBed.inject(HostelStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.stopHostelPolling();
    httpMock.verify();
    sessionStorage.clear();
  });

  it('starts idle with no allocation', () => {
    expect(store.loading()).toBeFalse();
    expect(store.activeAllocation()).toBeNull();
  });

  it('loads windows/hostels/applications/allocations/complaints', () => {
    store.load();
    flushInitialLoad();

    expect(store.applicationWindows().length).toBe(1);
    expect(store.hostels().length).toBe(1);
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('derives the single non-terminal allocation as activeAllocation (Invariant SS8.6)', () => {
    store.load();
    flushInitialLoad({
      allocations: [
        { ...allocation, id: 'alloc-old', status: 'CheckedOut' },
        { ...allocation, id: 'alloc-current', status: 'Active' },
      ],
    });

    expect(store.activeAllocation()?.id).toBe('alloc-current');
  });

  describe('preference draft', () => {
    beforeEach(() => {
      store.load();
      flushInitialLoad();
      store.selectWindow(activeWindow as never);
    });

    it('adds, reorders, and removes preferences', () => {
      store.addPreferenceToDraft({
        hostelId: 'h1',
        hostelName: 'Hostel A',
        preferredRoomType: 'SingleOccupancy',
      });
      store.addPreferenceToDraft({
        hostelId: 'h2',
        hostelName: 'Hostel B',
        preferredRoomType: 'DoubleOccupancy',
      });
      expect(store.preferenceDraft().length).toBe(2);

      store.movePreferenceUp(1);
      expect(store.preferenceDraft()[0].hostelId).toBe('h2');

      store.removePreferenceFromDraft(0);
      expect(store.preferenceDraft().length).toBe(1);
    });
  });

  describe('submitApplication', () => {
    beforeEach(() => {
      store.load();
      flushInitialLoad();
      store.selectWindow(activeWindow as never);
      store.addPreferenceToDraft({
        hostelId: 'h1',
        hostelName: 'Hostel A',
        preferredRoomType: 'SingleOccupancy',
      });
    });

    it('re-validates the window and hostel list before dispatching, then submits', () => {
      store.submitApplication({
        yearOfStudy: 2,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: 80,
      });

      httpMock.expectOne(`${baseUrl}/api/v1/hostel/application-windows/win-1`).flush(activeWindow);
      httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels`).flush([hostelA]);

      const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/applications`);
      expect(req.request.body).toEqual(
        jasmine.objectContaining({
          applicationWindowId: 'win-1',
          preferences: [{ hostelId: 'h1', preferredRoomType: 'SingleOccupancy', rank: 1 }],
        }),
      );
      req.flush({ id: 'app-1', status: 'Submitted' });

      flushInitialLoad({ applications: [{ id: 'app-1', status: 'Submitted' }] });
      expect(store.preferenceDraft()).toEqual([]);
      expect(store.submittingApplication()).toBeFalse();
    });

    it('blocks submission and reloads when the window has closed since browsing', () => {
      store.submitApplication({
        yearOfStudy: 2,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: 80,
      });

      httpMock
        .expectOne(`${baseUrl}/api/v1/hostel/application-windows/win-1`)
        .flush({ ...activeWindow, closesAt: '2020-01-01T00:00:00Z' });
      httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels`).flush([hostelA]);

      expect(store.applyError()).toBe('hostel.apply.windowClosed');
      flushInitialLoad();
    });

    it('drops a preference and blocks submission when its hostel no longer exists', () => {
      store.submitApplication({
        yearOfStudy: 2,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: 80,
      });

      httpMock.expectOne(`${baseUrl}/api/v1/hostel/application-windows/win-1`).flush(activeWindow);
      httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels`).flush([]);

      expect(store.applyError()).toBe('hostel.apply.preferenceUnavailable');
      expect(store.preferenceDraft()).toEqual([]);
    });

    it('refuses to submit while offline', () => {
      window.dispatchEvent(new Event('offline'));
      store.submitApplication({
        yearOfStudy: 2,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: 80,
      });
      expect(store.applyError()).toBe('hostel.apply.offline');
      httpMock.expectNone(`${baseUrl}/api/v1/hostel/application-windows/win-1`);
    });
  });

  describe('hostel fee payment', () => {
    beforeEach(() => {
      store.load();
      flushInitialLoad({ allocations: [allocation] });
      store.selectAllocationForPayment(allocation as never);
      httpMock.expectOne(`${baseUrl}/api/v1/finance/invoices/inv-1`).flush(hostelInvoice);
    });

    it('re-validates allocation state before dispatching payment, then submits', () => {
      store.initiateHostelFeePayment();
      httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`).flush([allocation]);

      const req = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      req.flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: 'https://gw/pay' });

      expect(readPendingPaymentAttempt('hostel-fee')?.paymentId).toBe('pay-1');
      expect(store.hostelRedirectUrl()).toBe('https://gw/pay');
    });

    it('blocks payment and refreshes when the allocation has changed since the screen opened', () => {
      store.initiateHostelFeePayment();
      httpMock
        .expectOne(`${baseUrl}/api/v1/hostel/allocations/me`)
        .flush([{ ...allocation, status: 'Active' }]);

      expect(store.allocationMismatchNotice()).toBe('hostel.payment.mismatch');
      httpMock.expectOne(`${baseUrl}/api/v1/finance/invoices/inv-1`).flush(hostelInvoice);
      httpMock.expectNone(`${baseUrl}/api/v1/finance/payments`);
    });

    it('refuses to initiate hostel-fee payment while offline', () => {
      window.dispatchEvent(new Event('offline'));
      store.initiateHostelFeePayment();
      expect(store.hostelPaymentError()).toBe('hostel.payment.offline');
      httpMock.expectNone(`${baseUrl}/api/v1/hostel/allocations/me`);
    });

    it('polls to a confirmed terminal status and reloads', async () => {
      store.initiateHostelFeePayment();
      httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`).flush([allocation]);
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments`)
        .flush({ payment: { id: 'pay-1', status: 'Initiated' }, redirectUrl: null });

      await wait(10);
      httpMock
        .expectOne(`${baseUrl}/api/v1/finance/payments/pay-1`)
        .flush({ id: 'pay-1', status: 'Successful' });

      expect(readPendingPaymentAttempt('hostel-fee')).toBeNull();
      flushInitialLoad({ allocations: [{ ...allocation, status: 'FeePaid' }] });
    });
  });

  it('checks out of an allocation', () => {
    store.load();
    flushInitialLoad({ allocations: [{ ...allocation, status: 'Active' }] });

    store.checkOut('alloc-1');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/alloc-1/check-out`);
    expect(req.request.body).toEqual({ checkOutType: 'Voluntary' });
    req.flush({ ...allocation, status: 'CheckedOut' });

    flushInitialLoad({ allocations: [{ ...allocation, status: 'CheckedOut' }] });
  });

  describe('submitComplaint', () => {
    beforeEach(() => {
      store.load();
      flushInitialLoad({ allocations: [{ ...allocation, status: 'Active' }] });
    });

    it('submits a complaint with a fresh idempotency key and reloads', () => {
      store.submitComplaint('alloc-1', 'Maintenance', 'Leaky faucet');
      const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/complaints`);
      expect(req.request.body.idempotencyKey).toBeTruthy();
      req.flush({ id: 'complaint-1', status: 'Open' });

      flushInitialLoad({
        allocations: [{ ...allocation, status: 'Active' }],
        complaints: [{ id: 'complaint-1', status: 'Open' }],
      });
      expect(store.complaintSubmitting()).toBeFalse();
    });

    it('refuses to submit a complaint while offline', () => {
      window.dispatchEvent(new Event('offline'));
      store.submitComplaint('alloc-1', 'Maintenance', 'Leaky faucet');
      expect(store.complaintError()).toBe('hostel.complaint.offline');
      httpMock.expectNone(`${baseUrl}/api/v1/hostel/complaints`);
    });
  });
});
