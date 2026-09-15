import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { addTrackedRequestId } from '../../core/state/student-request-tracking.util';
import { ResultsStore } from './results.store';

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

const transcript = {
  studentId: 'student-1',
  results: [
    {
      enrollmentId: 'enr-1',
      courseOfferingId: 'off-1',
      courseId: 'course-1',
      semesterId: 'sem-1',
      calculatedScore: 80,
      letterGrade: 'A-',
      creditHours: 3,
      publishedAt: '2026-01-01T00:00:00Z',
    },
    {
      enrollmentId: 'enr-2',
      courseOfferingId: 'off-2',
      courseId: 'course-2',
      semesterId: 'sem-2',
      calculatedScore: 90,
      letterGrade: 'A',
      creditHours: 3,
      publishedAt: '2026-06-01T00:00:00Z',
    },
  ],
  overallAverageScore: 85,
};

describe('ResultsStore', () => {
  let store: ResultsStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  /** The store resolves course code/title for each distinct courseId in the transcript -- flush those follow-up requests so httpMock.verify() doesn't see them dangling. */
  function flushCourseInfo(): void {
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/courses/course-1`)
      .flush({ id: 'course-1', code: 'CSE101', title: 'Intro to Programming' });
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/courses/course-2`)
      .flush({ id: 'course-2', code: 'CSE102', title: 'Data Structures' });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 10_000 } },
      ],
    });
    store = TestBed.inject(ResultsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts idle with no error and no published results', () => {
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.overallAverageScore()).toBeNull();
    expect(store.hasAnyPublishedResults()).toBeFalse();
  });

  it('loads the transcript and exposes the authoritative overallAverageScore verbatim', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    expect(store.loading()).toBeFalse();
    expect(store.overallAverageScore()).toBe(85);
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('groups published results into chronologically-ordered semester groups', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    expect(store.semesterGroups().length).toBe(2);
    expect(store.semesterGroups()[0].semesterId).toBe('sem-1');
    expect(store.hasAnyPublishedResults()).toBeTrue();
  });

  it('derives one GPA-trend point per semester group', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    expect(store.gpaTrendPoints().length).toBe(2);
    expect(store.gpaTrendPoints()[0].averageScore).toBe(80);
    expect(store.gpaTrendPoints()[1].averageScore).toBe(90);
  });

  it('sets an error and stops loading when the profile fetch fails', () => {
    store.load();
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/me`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBeFalse();
  });

  it('sets an error and stops loading when the transcript fetch fails', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBeFalse();
  });

  it('resumes a previously tracked transcript PDF request on load', () => {
    addTrackedRequestId('student-1', 'TranscriptRequest', 'req-1');

    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/requests/req-1`)
      .flush({ id: 'req-1', status: 'Submitted', generatedDocumentId: null });
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    expect(store.transcriptPdfRequestId()).toBe('req-1');
    expect(store.transcriptPdfStatus()).toBe('Submitted');
  });

  it('resolves the GeneratedDocument once the tracked request is fulfilled', () => {
    addTrackedRequestId('student-1', 'TranscriptRequest', 'req-1');

    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/requests/req-1`).flush({
      id: 'req-1',
      status: 'Fulfilled',
      generatedDocumentId: 'doc-1',
    });
    httpMock
      .expectOne(`${baseUrl}/api/v1/documents/doc-1`)
      .flush({ id: 'doc-1', status: 'Ready', downloadUrl: 'https://example.com/transcript.pdf' });
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    expect(store.transcriptPdfDocument()?.downloadUrl).toBe('https://example.com/transcript.pdf');
  });

  it('submits a new transcript PDF request and starts tracking it', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    store.requestTranscriptPdf('en');
    const req = httpMock.expectOne(`${baseUrl}/api/v1/student/students/requests/`);
    expect(req.request.body).toEqual(
      jasmine.objectContaining({ requestType: 'TranscriptRequest', purpose: 'en' }),
    );
    req.flush({ id: 'req-new', status: 'Submitted' });

    expect(store.transcriptPdfRequestId()).toBe('req-new');
    expect(store.transcriptPdfStatus()).toBe('Submitted');
    expect(store.transcriptPdfSubmitting()).toBeFalse();
  });

  it('does not submit a second transcript PDF request while one is already in flight', () => {
    store.load();
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`)
      .flush(transcript);
    flushCourseInfo();

    store.requestTranscriptPdf('en');
    expect(store.transcriptPdfSubmitting()).toBeTrue();

    store.requestTranscriptPdf('bn');
    httpMock
      .expectOne(`${baseUrl}/api/v1/student/students/requests/`)
      .flush({ id: 'req-1', status: 'Submitted' });
  });
});
