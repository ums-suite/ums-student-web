import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { StudentApi } from './student.api';

describe('StudentApi', () => {
  let api: StudentApi;
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
    api = TestBed.inject(StudentApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("fetches the caller's own profile from GET /api/v1/student/students/me", () => {
    api.getMyProfile().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('submits a StudentRequest', async () => {
    const body = {
      requestType: 'IdReissue' as const,
      reason: 'Lost my card',
      purpose: null,
      description: null,
      isAgainstOwnDepartmentHead: false,
    };
    const result$ = new Promise((resolve) => api.submitStudentRequest(body).subscribe(resolve));
    const req = httpMock.expectOne(`${baseUrl}/api/v1/student/students/requests/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'req-1', status: 'Submitted' });
    expect(await result$).toEqual(jasmine.objectContaining({ status: 'Submitted' }));
  });

  it('gets a StudentRequest by id', async () => {
    const result$ = new Promise((resolve) => api.getStudentRequest('req-1').subscribe(resolve));
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/requests/req-1`).flush({ id: 'req-1' });
    expect(await result$).toEqual(jasmine.objectContaining({ id: 'req-1' }));
  });
});
