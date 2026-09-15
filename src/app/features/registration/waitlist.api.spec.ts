import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { WaitlistApi } from './waitlist.api';

describe('WaitlistApi', () => {
  let api: WaitlistApi;
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
    api = TestBed.inject(WaitlistApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('joins the waitlist for an offering', async () => {
    const promise = new Promise((resolve) => api.joinWaitlist('off-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist`)
      .flush({ position: 4, offer: null });
    expect(await promise).toEqual({ position: 4, offer: null });
  });

  it('resolves to null (not an error) if the assumed endpoint 404s', async () => {
    const promise = new Promise((resolve) => api.joinWaitlist('off-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(await promise).toBeNull();
  });

  it('fetches the current waitlist status', async () => {
    const promise = new Promise((resolve) => api.getMyWaitlistStatus('off-1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/me`)
      .flush({ position: 2, offer: null });
    expect(await promise).toEqual({ position: 2, offer: null });
  });

  it('confirms a waitlist offer via POST', () => {
    api.confirmWaitlistOffer('off-1').subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/confirm`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('propagates a non-404 error from getMyWaitlistStatus', async () => {
    const errorPromise = new Promise((resolve) =>
      api.getMyWaitlistStatus('off-1').subscribe({ error: resolve }),
    );
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/me`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    const error = (await errorPromise) as { status: number };
    expect(error.status).toBe(500);
  });
});
