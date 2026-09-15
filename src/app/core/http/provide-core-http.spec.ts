import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '@ums/shared';
import { environment } from '../../../environments/environment';
import { provideCoreHttp } from './provide-core-http';

describe('provideCoreHttp', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideCoreHttp(), provideHttpClientTesting()],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches a correlation id and locale query param to every outgoing request', () => {
    httpClient.get(`${environment.apiBaseUrl}/api/v1/academic/course-offerings`).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/api/v1/academic/course-offerings`,
    );
    expect(req.request.headers.has('X-Correlation-Id')).toBeTrue();
    expect(req.request.params.get('lang')).toBe('en');
    req.flush({});
  });

  it('attaches a bearer token when a session is present', () => {
    TestBed.inject(TokenStorageService).setTokens({
      accessToken: 'token-123',
      accessTokenExpiresAt: '2026-01-01T00:15:00Z',
      refreshToken: 'refresh-123',
      refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
      sessionId: 'session-1',
    });

    httpClient.get(`${environment.apiBaseUrl}/api/v1/student/students/me`).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/api/v1/student/students/me`,
    );
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });
});
