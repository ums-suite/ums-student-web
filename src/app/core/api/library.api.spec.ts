import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { LibraryApi } from './library.api';

describe('LibraryApi', () => {
  let api: LibraryApi;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    api = TestBed.inject(LibraryApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searches books with the confirmed filter params, defaulting page/pageSize', async () => {
    const result$ = new Promise((resolve) =>
      api.searchBooks({ q: 'algorithms' }).subscribe(resolve),
    );
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/library/books/` &&
        r.params.get('q') === 'algorithms' &&
        r.params.get('page') === '1' &&
        r.params.get('pageSize') === '20',
    );
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    expect(await result$).toEqual(jasmine.objectContaining({ totalCount: 0 }));
  });

  it('gets a book by id', async () => {
    const result$ = new Promise((resolve) => api.getBook('book-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/library/books/book-1`).flush({ id: 'book-1' });
    expect(await result$).toEqual(jasmine.objectContaining({ id: 'book-1' }));
  });

  it('lists copies for a book', async () => {
    const result$ = new Promise((resolve) => api.listCopies('book-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/library/books/book-1/copies`).flush([{ id: 'copy-1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'copy-1' })]);
  });

  it('lists my loans', async () => {
    const result$ = new Promise((resolve) => api.getMyLoans().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/library/loans/me`).flush([{ id: 'loan-1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'loan-1' })]);
  });

  it('renews a loan', async () => {
    const result$ = new Promise((resolve) => api.renewLoan('loan-1').subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/loans/loan-1/renew`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'loan-1', renewalCount: 1 });
    expect(await result$).toEqual(jasmine.objectContaining({ renewalCount: 1 }));
  });

  it('lists my reservations', async () => {
    const result$ = new Promise((resolve) => api.getMyReservations().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/library/reservations/me`).flush([{ id: 'res-1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'res-1' })]);
  });

  it('creates a reservation for a book', async () => {
    const result$ = new Promise((resolve) => api.reserveBook('book-1').subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/reservations/`);
    expect(req.request.body).toEqual({ bookId: 'book-1' });
    req.flush({ id: 'res-1', status: 'Queued' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'Queued' }));
  });

  it('lists my fines', async () => {
    const result$ = new Promise((resolve) => api.getMyFines().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/library/fines/me`).flush([{ id: 'fine-1' }]);
    expect(await result$).toEqual([jasmine.objectContaining({ id: 'fine-1' })]);
  });

  it('initiates fine settlement', async () => {
    const result$ = new Promise((resolve) => api.settleFine('fine-1').subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/library/fines/fine-1/settle`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'fine-1', status: 'PendingSettlement' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'PendingSettlement' }));
  });
});
