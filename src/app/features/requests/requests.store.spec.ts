import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { addTrackedRequestId } from '../../core/state/student-request-tracking.util';
import { RequestsStore } from './requests.store';

const student = {
  id: 'student-1',
  studentNumber: 'S-001',
  departmentId: 'dept-1',
  programId: 'program-1',
  givenName: 'Ayesha',
  familyName: 'Rahman',
  givenNameBn: null,
  familyNameBn: null,
  email: 'a@example.com',
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

describe('RequestsStore', () => {
  let store: RequestsStore;
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
    store = TestBed.inject(RequestsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts idle with no requests', () => {
    expect(store.loading()).toBeFalse();
    expect(store.requests()).toEqual([]);
  });

  it('resolves to an empty list when nothing is tracked yet', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    expect(store.requests()).toEqual([]);
    expect(store.loading()).toBeFalse();
  });

  it('loads every tracked request across all three types, newest first', () => {
    addTrackedRequestId('student-1', 'IdReissue', 'req-1');
    addTrackedRequestId('student-1', 'Grievance', 'req-2');

    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/requests/req-1`)
      .flush({ id: 'req-1', requestType: 'IdReissue', submittedAt: '2026-01-01T00:00:00Z' });
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/requests/req-2`)
      .flush({ id: 'req-2', requestType: 'Grievance', submittedAt: '2026-02-01T00:00:00Z' });

    expect(store.requests().length).toBe(2);
    expect(store.requests()[0].id).toBe('req-2');
  });

  it('sets an error when the profile fetch fails', () => {
    store.load();
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/me`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });
    expect(store.error()).toBeTruthy();
  });

  describe('submit', () => {
    beforeEach(() => {
      store.load();
      httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    });

    it('submits and tracks a new request, then reloads', () => {
      store.submit('IdReissue', {
        reason: 'Lost my card',
        purpose: null,
        description: null,
        isAgainstOwnDepartmentHead: false,
      });

      const req = httpMock.expectOne(`${baseUrl}/api/v1/student/students/requests/`);
      expect(req.request.body).toEqual(
        jasmine.objectContaining({ requestType: 'IdReissue', reason: 'Lost my card' }),
      );
      req.flush({ id: 'req-1', requestType: 'IdReissue', submittedAt: '2026-01-01T00:00:00Z' });

      httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
      httpMock
        .expectOne(`${baseUrl}/api/v1/student/students/requests/req-1`)
        .flush({ id: 'req-1', requestType: 'IdReissue', submittedAt: '2026-01-01T00:00:00Z' });

      expect(store.submitting()).toBeFalse();
      expect(store.requests().length).toBe(1);
    });

    it('refuses to submit while offline', () => {
      window.dispatchEvent(new Event('offline'));
      store.submit('Grievance', {
        reason: null,
        purpose: null,
        description: 'Issue',
        isAgainstOwnDepartmentHead: false,
      });
      expect(store.submitError()).toBe('requests.offline');
      httpMock.expectNone(`${baseUrl}/api/v1/student/students/requests/`);
    });

    it('surfaces a submit error from the server', () => {
      store.submit('TranscriptRequest', {
        reason: null,
        purpose: 'For scholarship',
        description: null,
        isAgainstOwnDepartmentHead: false,
      });
      httpMock
        .expectOne(`${baseUrl}/api/v1/student/students/requests/`)
        .flush({ title: 'Bad request' }, { status: 400, statusText: 'Bad Request' });
      expect(store.submitError()).toBeTruthy();
      expect(store.submitting()).toBeFalse();
    });
  });
});
