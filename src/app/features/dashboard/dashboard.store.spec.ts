import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '@ums/shared';
import { APP_CONFIG } from '../../core/config/app-config';
import { DashboardStore } from './dashboard.store';

function tokenFor(userId: string): {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
} {
  const payload = { sub: userId, sid: 'session-1', roles: ['Student'] };
  const base64 = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  return {
    accessToken: `header.${base64}.signature`,
    accessTokenExpiresAt: '2026-01-01T00:15:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
    sessionId: 'session-1',
  };
}

const student = {
  id: 'student-1',
  studentNumber: 'S-001',
  departmentId: 'dept-1',
  programId: 'program-1',
  givenName: 'Ayesha',
  familyName: 'Rahman',
  givenNameBn: null,
  familyNameBn: null,
  email: 'ayesha@example.com',
  mobile: null,
  dateOfBirth: '2000-01-01',
  nationalId: null,
  status: 'Active',
  identityUserId: 'user-1',
  idCardDocumentId: null,
  contactEmail: null,
  contactPhone: null,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  version: 1,
};

describe('DashboardStore', () => {
  let store: DashboardStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    store = TestBed.inject(DashboardStore);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setTokens(tokenFor('user-1'));
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts idle with no snapshot', () => {
    expect(store.loading()).toBeFalse();
    expect(store.snapshot()).toBeNull();
  });

  it('composes a snapshot from all four module reads', () => {
    store.load();
    expect(store.loading()).toBeTrue();

    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/programs/program-1`).flush({
      id: 'program-1',
      departmentId: 'dept-1',
      code: 'CSE',
      name: 'Computer Science',
      maxCreditsPerSemester: 18,
      requiresAdvisorApproval: false,
      createdAt: '2026-01-01T00:00:00Z',
    });
    httpMock
      .expectOne((r) => r.url === `${baseUrl}/api/v1/finance/invoices`)
      .flush([
        {
          id: 'inv-1',
          sourceModule: 'Finance',
          sourceReferenceId: 'ref-1',
          feeType: 'Tuition',
          ownerId: 'user-1',
          totalAmount: 500,
          currency: 'BDT',
          status: 'Open',
          createdAt: '2026-01-01T00:00:00Z',
          paidAt: null,
        },
      ]);
    httpMock
      .expectOne(`${baseUrl}/api/v1/hostel/allocations/me`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`).flush({
      studentId: 'student-1',
      results: [],
      overallAverageScore: 3.7,
    });

    expect(store.loading()).toBeFalse();
    const snapshot = store.snapshot();
    expect(snapshot?.student.givenName).toBe('Ayesha');
    expect(snapshot?.outstandingBalance).toBe(500);
    expect(snapshot?.allocation).toBeNull();
    expect(snapshot?.overallAverageScore).toBe(3.7);
    expect(snapshot?.attentionItems.some((i) => i.id === 'fee-due')).toBeTrue();
  });

  it('sets an error and stops loading when the student profile fetch fails', () => {
    store.load();
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/me`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeTruthy();
    expect(store.snapshot()).toBeNull();
  });

  it('degrades gracefully when a non-fatal read (program) fails', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/programs/program-1`)
      .flush({ title: 'Not found' }, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne((r) => r.url === `${baseUrl}/api/v1/finance/invoices`).flush([]);
    httpMock
      .expectOne(`${baseUrl}/api/v1/hostel/allocations/me`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`).flush({
      studentId: 'student-1',
      results: [],
      overallAverageScore: null,
    });

    expect(store.snapshot()?.program).toBeNull();
    expect(store.error()).toBeNull();
  });
});
