import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { OrganizationApi } from './organization.api';

describe('OrganizationApi', () => {
  let api: OrganizationApi;
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
    api = TestBed.inject(OrganizationApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists buildings as a paged envelope, optionally filtered by campus', async () => {
    const result$ = new Promise((resolve) => api.listBuildings('campus-1').subscribe(resolve));
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/organization/buildings/` &&
        r.params.get('campusId') === 'campus-1',
    );
    req.flush({ items: [{ id: 'b1' }], totalCount: 1, skip: 0, take: 20 });
    expect(await result$).toEqual(jasmine.objectContaining({ totalCount: 1 }));
  });

  it('gets a building by id', async () => {
    const result$ = new Promise((resolve) => api.getBuilding('b1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/organization/buildings/b1`).flush({ id: 'b1' });
    expect(await result$).toEqual(jasmine.objectContaining({ id: 'b1' }));
  });

  it('lists rooms for a building as a paged envelope', async () => {
    const result$ = new Promise((resolve) => api.listRoomsForBuilding('b1').subscribe(resolve));
    httpMock
      .expectOne(`${baseUrl}/api/v1/organization/buildings/b1/rooms`)
      .flush({ items: [{ id: 'r1' }], totalCount: 1, skip: 0, take: 20 });
    expect(await result$).toEqual(jasmine.objectContaining({ totalCount: 1 }));
  });

  it('gets a room by id', async () => {
    const result$ = new Promise((resolve) => api.getRoom('r1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/organization/rooms/r1`).flush({ id: 'r1' });
    expect(await result$).toEqual(jasmine.objectContaining({ id: 'r1' }));
  });
});
