import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { FinanceApi } from './finance.api';

describe('FinanceApi', () => {
  let api: FinanceApi;
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
    api = TestBed.inject(FinanceApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists invoices scoped to the given ownerId', () => {
    api.listMyInvoices('student-1').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/finance/invoices` && r.params.get('ownerId') === 'student-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets a single invoice by id', async () => {
    const result$ = new Promise((resolve) => api.getInvoice('inv-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/finance/invoices/inv-1`).flush({ id: 'inv-1' });
    expect(await result$).toEqual(jasmine.objectContaining({ id: 'inv-1' }));
  });

  it('initiates a payment with the Idempotency-Key header, never in the body', async () => {
    const result$ = new Promise((resolve) =>
      api.initiatePayment({ invoiceId: 'inv-1' }, 'idem-key-1').subscribe(resolve),
    );

    const req = httpMock.expectOne(`${baseUrl}/api/v1/finance/payments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ invoiceId: 'inv-1' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('idem-key-1');
    req.flush({
      payment: { id: 'pay-1', status: 'Initiated' },
      redirectUrl: 'https://gateway.example/pay',
    });

    expect(await result$).toEqual(
      jasmine.objectContaining({ redirectUrl: 'https://gateway.example/pay' }),
    );
  });

  it('gets payment status by id', async () => {
    const result$ = new Promise((resolve) => api.getPayment('pay-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/finance/payments/pay-1`)
      .flush({ id: 'pay-1', status: 'Successful' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'Successful' }));
  });
});
