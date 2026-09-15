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
});
