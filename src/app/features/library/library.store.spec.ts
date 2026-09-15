import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { LibraryStore } from './library.store';

const activeLoan = {
  id: 'loan-1',
  bookCopyId: 'copy-1',
  bookId: 'book-1',
  borrowerId: 'student-1',
  borrowerType: 'Student',
  issuedByUserId: 'staff-1',
  issuedAt: '2026-01-01T00:00:00Z',
  dueDate: '2026-02-01T00:00:00Z',
  renewalCount: 0,
  status: 'Active',
  isOverdue: false,
  returnedAt: null,
  lostWriteOffAt: null,
};

describe('LibraryStore', () => {
  let store: LibraryStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  function flushInitialLoad(
    loans: unknown[] = [],
    reservations: unknown[] = [],
    fines: unknown[] = [],
  ): void {
    httpMock.expectOne(`${baseUrl}/api/v1/library/loans/me`).flush(loans);
    httpMock.expectOne(`${baseUrl}/api/v1/library/reservations/me`).flush(reservations);
    httpMock.expectOne(`${baseUrl}/api/v1/library/fines/me`).flush(fines);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    store = TestBed.inject(LibraryStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts idle with no loans', () => {
    expect(store.loading()).toBeFalse();
    expect(store.loans()).toEqual([]);
  });

  it('loads loans/reservations/fines and derives active/overdue/outstanding', () => {
    store.load();
    flushInitialLoad(
      [activeLoan, { ...activeLoan, id: 'loan-2', isOverdue: true }],
      [],
      [
        { id: 'fine-1', status: 'Accruing' },
        { id: 'fine-2', status: 'Paid' },
      ],
    );

    expect(store.activeLoans().length).toBe(2);
    expect(store.overdueLoans().length).toBe(1);
    expect(store.outstandingFines().length).toBe(1);
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('searches books', () => {
    store.searchBooks({ q: 'algorithms' });
    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/library/books/` && r.params.get('q') === 'algorithms',
    );
    req.flush({ items: [{ id: 'book-1' }], totalCount: 1, page: 1, pageSize: 20 });

    expect(store.searchResults()?.totalCount).toBe(1);
    expect(store.searching()).toBeFalse();
  });

  it('renews a loan and reloads', () => {
    store.renewLoan('loan-1');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/loans/loan-1/renew`);
    req.flush({ ...activeLoan, renewalCount: 1 });
    flushInitialLoad([{ ...activeLoan, renewalCount: 1 }]);
    expect(store.renewError()).toBeNull();
  });

  it('surfaces a renew error code', () => {
    store.renewLoan('loan-1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/library/loans/loan-1/renew`)
      .flush(
        { code: 'loan.max_renewals_exceeded', title: 'Cannot renew' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(store.renewError()).toBe('library.renew.error.maxRenewals');
  });

  it('refuses to renew while offline', () => {
    window.dispatchEvent(new Event('offline'));
    store.renewLoan('loan-1');
    expect(store.renewError()).toBe('library.offline');
    httpMock.expectNone(`${baseUrl}/api/v1/library/loans/loan-1/renew`);
  });

  it('reserves a book and reloads', () => {
    store.reserveBook('book-1');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/reservations/`);
    req.flush({ id: 'res-1', status: 'Queued' });
    flushInitialLoad([], [{ id: 'res-1', status: 'Queued' }]);
    expect(store.reservationError()).toBeNull();
  });

  it('classifies a reservation.copy_available rejection specifically', () => {
    store.reserveBook('book-1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/library/reservations/`)
      .flush(
        { code: 'reservation.copy_available', title: 'Copy available' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(store.reservationError()).toBe('library.reservation.error.copyNowAvailable');
  });

  it('refuses to reserve while offline', () => {
    window.dispatchEvent(new Event('offline'));
    store.reserveBook('book-1');
    expect(store.reservationError()).toBe('library.offline');
    httpMock.expectNone(`${baseUrl}/api/v1/library/reservations/`);
  });

  it('initiates fine settlement and reloads', () => {
    store.settleFine('fine-1');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/fines/fine-1/settle`);
    req.flush({ id: 'fine-1', status: 'PendingSettlement' });
    flushInitialLoad([], [], [{ id: 'fine-1', status: 'PendingSettlement' }]);
    expect(store.settleError()).toBeNull();
  });

  it('refuses to settle a fine while offline', () => {
    window.dispatchEvent(new Event('offline'));
    store.settleFine('fine-1');
    expect(store.settleError()).toBe('library.offline');
    httpMock.expectNone(`${baseUrl}/api/v1/library/fines/fine-1/settle`);
  });
});
