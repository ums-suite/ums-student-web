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

  it('resolves the allocation list on success (confirmed: a list, never a single object)', async () => {
    const result$ = api.getMyAllocations();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush([{ id: 'alloc-1', status: 'Active' }]);

    expect(await promise).toEqual([jasmine.objectContaining({ id: 'alloc-1' })]);
  });

  it('resolves an empty array when the student has no allocation history (200, never a 404)', async () => {
    const result$ = api.getMyAllocations();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush([]);

    expect(await promise).toEqual([]);
  });

  it('propagates a non-2xx error', async () => {
    const result$ = api.getMyAllocations();
    const errorPromise = new Promise((resolve) => result$.subscribe({ error: resolve }));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/me`);
    req.flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    const error = (await errorPromise) as { status: number };
    expect(error.status).toBe(500);
  });

  it('lists my hostel applications', async () => {
    const result$ = api.getMyApplications();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    httpMock.expectOne(`${baseUrl}/api/v1/hostel/applications/me`).flush([{ id: 'app-1' }]);

    expect(await promise).toEqual([jasmine.objectContaining({ id: 'app-1' })]);
  });

  it('submits a hostel application', async () => {
    const body = {
      applicationWindowId: 'win-1',
      yearOfStudy: 2,
      hasFinancialNeed: false,
      homeDistrictDistanceKm: null,
      preferences: [{ hostelId: 'h1', preferredRoomType: 'SingleOccupancy' as const, rank: 1 }],
    };
    const result$ = api.submitApplication(body);
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/applications`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'app-1' });

    expect(await promise).toEqual(jasmine.objectContaining({ id: 'app-1' }));
  });

  it('checks out of an allocation', async () => {
    const result$ = api.checkOut('alloc-1', { checkOutType: 'Voluntary' });
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/allocations/alloc-1/check-out`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'alloc-1', status: 'CheckedOut' });

    expect(await promise).toEqual(jasmine.objectContaining({ status: 'CheckedOut' }));
  });

  it('submits a complaint', async () => {
    const body = {
      allocationId: 'alloc-1',
      category: 'Maintenance' as const,
      description: 'Leaky faucet',
      idempotencyKey: 'idem-1',
    };
    const result$ = api.submitComplaint(body);
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/complaints`);
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'complaint-1' });

    expect(await promise).toEqual(jasmine.objectContaining({ id: 'complaint-1' }));
  });

  it('lists my complaints', async () => {
    const result$ = api.getMyComplaints();
    const promise = new Promise((resolve) => result$.subscribe(resolve));

    httpMock.expectOne(`${baseUrl}/api/v1/hostel/complaints/me`).flush([{ id: 'complaint-1' }]);

    expect(await promise).toEqual([jasmine.objectContaining({ id: 'complaint-1' })]);
  });

  it('lists hostels / buildings / rooms / beds', async () => {
    const hostels$ = new Promise((resolve) => api.listHostels().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels`).flush([{ id: 'h1' }]);
    expect(await hostels$).toEqual([jasmine.objectContaining({ id: 'h1' })]);

    const buildings$ = new Promise((resolve) => api.listBuildings('h1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/hostels/h1/buildings`).flush([{ id: 'b1' }]);
    expect(await buildings$).toEqual([jasmine.objectContaining({ id: 'b1' })]);

    const rooms$ = new Promise((resolve) => api.listRooms('b1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/buildings/b1/rooms`).flush([{ id: 'r1' }]);
    expect(await rooms$).toEqual([jasmine.objectContaining({ id: 'r1' })]);

    const beds$ = new Promise((resolve) => api.listBeds('r1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/rooms/r1/beds`).flush([{ id: 'bed1' }]);
    expect(await beds$).toEqual([jasmine.objectContaining({ id: 'bed1' })]);
  });

  it('lists and gets application windows', async () => {
    const list$ = new Promise((resolve) => api.listApplicationWindows().subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/application-windows`).flush([{ id: 'win-1' }]);
    expect(await list$).toEqual([jasmine.objectContaining({ id: 'win-1' })]);

    const one$ = new Promise((resolve) => api.getApplicationWindow('win-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/hostel/application-windows/win-1`).flush({ id: 'win-1' });
    expect(await one$).toEqual(jasmine.objectContaining({ id: 'win-1' }));
  });

  it('withdraws an application', async () => {
    const result$ = new Promise((resolve) => api.withdrawApplication('app-1').subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/hostel/applications/app-1/withdraw`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'app-1', status: 'Withdrawn' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'Withdrawn' }));
  });
});
