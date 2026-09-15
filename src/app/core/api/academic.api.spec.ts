import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { AcademicApi } from './academic.api';

describe('AcademicApi', () => {
  let api: AcademicApi;
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
    api = TestBed.inject(AcademicApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists course offerings filtered by semester query param', () => {
    api.listCourseOfferings('sem-1').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/academic/course-offerings` &&
        r.params.get('semester') === 'sem-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('fetches one course offering by id', () => {
    api.getCourseOffering('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches a course by id', () => {
    api.getCourse('course-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/courses/course-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches a program by id', () => {
    api.getProgram('program-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/programs/program-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches an academic session by id', () => {
    api.getAcademicSession('session-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates an enrollment via POST', () => {
    api
      .createEnrollment({
        courseOfferingId: 'off-1',
        sectionId: 'sec-1',
        prerequisiteOverrideReason: null,
      })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      courseOfferingId: 'off-1',
      sectionId: 'sec-1',
      prerequisiteOverrideReason: null,
    });
    req.flush({});
  });

  it('drops an enrollment via DELETE with a body', () => {
    api.dropEnrollment('enr-1', { reason: 'schedule conflict' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ reason: 'schedule conflict' });
    req.flush({});
  });

  it('fetches one enrollment by id', () => {
    api.getEnrollment('enr-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches published results for a student', () => {
    api.getMyPublishedResults('student-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/results`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('fetches a transcript for a student', () => {
    api.getMyTranscript('student-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/transcript`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
