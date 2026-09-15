import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { HostelApi } from './hostel.api';

describe('HostelApi', () => {
  let api: HostelApi;
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
    api = TestBed.inject(HostelApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('resolves the allocation on success', async () => {
    const result$ = api.getMyAllocation();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush({ id: 'alloc-1', status: 'Active' });

    expect(await promise).toEqual(jasmine.objectContaining({ id: 'alloc-1' }));
  });

  it('resolves to null (not an error) on a 404 -- no active allocation', async () => {
    const result$ = api.getMyAllocation();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush({ title: 'Not found' }, { status: 404, statusText: 'Not Found' });

    expect(await promise).toBeNull();
  });

  it('propagates a non-404 error', async () => {
    const result$ = api.getMyAllocation();
    const errorPromise = new Promise((resolve) => result$.subscribe({ error: resolve }));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    const error = (await errorPromise) as { status: number };
    expect(error.status).toBe(500);
  });
});
