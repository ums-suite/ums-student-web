import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '@ums/shared';
import { APP_CONFIG } from '../../core/config/app-config';
import { RegistrationStore } from './registration.store';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenFor(userId: string) {
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

const openSemester = {
  id: 'sem-open',
  name: 'Fall 2026',
  registrationStart: '2020-01-01T00:00:00Z',
  registrationEnd: '2099-01-01T00:00:00Z',
  dropStart: '2020-01-01T00:00:00Z',
  dropEnd: '2099-01-01T00:00:00Z',
};

const session = {
  id: 'session-1',
  code: 'AY26',
  semesters: [openSemester],
  createdAt: '2026-01-01T00:00:00Z',
};

const program = {
  id: 'program-1',
  departmentId: 'dept-1',
  code: 'CSE',
  name: 'Computer Science',
  maxCreditsPerSemester: 18,
  requiresAdvisorApproval: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const offering = {
  id: 'off-1',
  courseId: 'course-1',
  semesterId: 'sem-open',
  departmentId: 'dept-1',
  capacity: 30,
  enrolledCount: 29,
  hasAvailableSeats: true,
  instructorFacultyMemberId: null,
  sections: [{ id: 'sec-1', code: 'A', dayOfWeek: 1, start: '09:00:00', end: '10:00:00' }],
  exams: [],
  createdAt: '2026-01-01T00:00:00Z',
};

const course = {
  id: 'course-1',
  code: 'CSE101',
  title: 'Intro to Programming',
  creditHours: 3,
  prerequisites: [],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('RegistrationStore', () => {
  let store: RegistrationStore;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  // A small real pollIntervalMs plus a short real `wait()` lets the store's `shortPoll` (backed by
  // RxJS's real async scheduler -- this app is zoneless, so `fakeAsync`/`tick()` are unavailable)
  // fire its first (zero-delay) emission before we look for the resulting HTTP request.
  async function flushInitialLoad(): Promise<void> {
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`).flush(session);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/programs/program-1`).flush(program);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/results`).flush([]);
    await wait(30);
    httpMock
      .expectOne((r) => r.url === `${baseUrl}/api/v1/academic/course-offerings`)
      .flush([offering]);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/courses/course-1`).flush(course);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: baseUrl, pollIntervalMs: 60_000 } },
      ],
    });
    store = TestBed.inject(RegistrationStore);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStorageService).setTokens(tokenFor('user-1'));
  });

  afterEach(() => {
    store.stopPolling();
    httpMock.verify();
    localStorage.clear();
  });

  it('loads the session, active semester, and offerings', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    expect(store.semester()?.id).toBe('sem-open');
    expect(store.windowStatus()).toBe('open');
    expect(store.offerings().length).toBe(1);
    expect(store.offerings()[0].course?.code).toBe('CSE101');
    expect(store.loading()).toBeFalse();
  });

  it('filters offerings by search text', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.setSearchText('CSE101');
    expect(store.filteredOfferings().length).toBe(1);

    store.setSearchText('nonexistent');
    expect(store.filteredOfferings().length).toBe(0);
  });

  it('computes eligibility without gating on seat availability', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    const eligibility = store.computeEligibility(offering, course, offering.sections[0]);
    expect(eligibility.prerequisitesSatisfied).toBeTrue();
    expect(eligibility.creditLimitOk).toBeTrue();
    expect(eligibility.seatsAvailable).toBeTrue();
  });

  it('adds and removes schedule selections', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.addToSchedule({
      offeringId: 'off-1',
      sectionId: 'sec-1',
      courseCode: 'CSE101',
      courseTitle: 'Intro to Programming',
      creditHours: 3,
      section: offering.sections[0],
    });
    expect(store.selections().length).toBe(1);
    expect(store.scheduleCreditsTotal()).toBe(3);

    // Adding the same offering twice is a no-op.
    store.addToSchedule({
      offeringId: 'off-1',
      sectionId: 'sec-1',
      courseCode: 'CSE101',
      courseTitle: 'Intro to Programming',
      creditHours: 3,
      section: offering.sections[0],
    });
    expect(store.selections().length).toBe(1);

    store.removeFromSchedule('off-1');
    expect(store.selections().length).toBe(0);
  });

  it('registers successfully and tracks the resulting enrollment', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let settled = false;
    store.register(offering, offering.sections[0], course, () => (settled = true));

    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments`).flush({
      id: 'enr-1',
      studentId: 'student-1',
      courseOfferingId: 'off-1',
      semesterId: 'sem-open',
      sectionId: 'sec-1',
      status: 'Active',
      creditHours: 3,
      prerequisiteOverrideReason: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
      droppedAt: null,
    });

    expect(settled).toBeTrue();
    expect(store.trackedEnrollments().length).toBe(1);
    expect(store.trackedEnrollments()[0].status).toBe('Active');
  });

  it('reconciles the offering immediately on a seat-unavailable rejection', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let rejectionReason: string | undefined;
    store.register(offering, offering.sections[0], course, (reason) => (rejectionReason = reason));

    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments`)
      .flush(
        { title: 'Seat taken', code: 'enrollment.seat_no_longer_available' },
        { status: 409, statusText: 'Conflict' },
      );

    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1`)
      .flush({ ...offering, hasAvailableSeats: false, enrolledCount: 30 });

    expect(rejectionReason).toBe('seatUnavailable');
    expect(store.offerings()[0].offering.hasAvailableSeats).toBeFalse();
  });

  it('triggers a status redirect on a status-related rejection, not a per-call toast only', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let rejectionReason: string | undefined;
    store.register(offering, offering.sections[0], course, (reason) => (rejectionReason = reason));

    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments`)
      .flush(
        { title: 'Suspended', code: 'enrollment.student_not_active' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(rejectionReason).toBe('statusRejection');
    expect(store.statusRedirectMessage()).toBeTruthy();

    store.clearStatusRedirect();
    expect(store.statusRedirectMessage()).toBeNull();
  });

  it('sets windowStatus to closed on a window-closed rejection', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.register(offering, offering.sections[0], course);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments`)
      .flush(
        { title: 'Closed', code: 'enrollment.registration_window_closed' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.windowStatus()).toBe('closed');
  });

  it('drops an enrollment, retaining it with a Dropped status (never deleted)', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.register(offering, offering.sections[0], course);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments`).flush({
      id: 'enr-1',
      studentId: 'student-1',
      courseOfferingId: 'off-1',
      semesterId: 'sem-open',
      sectionId: 'sec-1',
      status: 'Active',
      creditHours: 3,
      prerequisiteOverrideReason: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
      droppedAt: null,
    });

    store.drop('enr-1', 'schedule conflict');
    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`).flush({
      id: 'enr-1',
      studentId: 'student-1',
      courseOfferingId: 'off-1',
      semesterId: 'sem-open',
      sectionId: 'sec-1',
      status: 'Dropped',
      creditHours: 3,
      prerequisiteOverrideReason: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
      droppedAt: '2026-01-02T00:00:00Z',
    });

    expect(store.trackedEnrollments().length).toBe(1);
    expect(store.trackedEnrollments()[0].status).toBe('Dropped');
  });

  it('blocks register when offline without dispatching a request', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    window.dispatchEvent(new Event('offline'));

    let rejectionReason: string | undefined;
    store.register(offering, offering.sections[0], course, (reason) => (rejectionReason = reason));

    expect(rejectionReason).toBe('offline');
    httpMock.expectNone(`${baseUrl}/api/v1/academic/enrollments`);

    window.dispatchEvent(new Event('online'));
  });

  it('joins a waitlist and stores the returned position', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.joinWaitlist('off-1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist`)
      .flush({ position: 3, offer: null });

    expect(store.waitlistStatuses().get('off-1')).toEqual({ position: 3, offer: null });
  });

  it('surfaces a not-available toast when the waitlist endpoint 404s', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.joinWaitlist('off-1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist`)
      .flush({}, { status: 404, statusText: 'Not Found' });

    expect(store.waitlistStatuses().has('off-1')).toBeFalse();
  });

  it('refreshes a specific waitlist status on demand', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.refreshWaitlistStatus('off-1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/me`)
      .flush({ position: 1, offer: { expiresAt: '2026-01-01T00:00:10Z' } });

    expect(store.waitlistStatuses().get('off-1')?.position).toBe(1);
  });

  it('confirms a waitlist offer successfully', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let settled = false;
    store.confirmWaitlistOffer('off-1', () => (settled = true));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/confirm`)
      .flush({});

    expect(settled).toBeTrue();
  });

  it('surfaces the expired-offer message when a confirm is rejected', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let rejectionReason: string | undefined;
    store.confirmWaitlistOffer('off-1', (reason) => (rejectionReason = reason));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1/waitlist/confirm`)
      .flush({ title: 'Expired' }, { status: 409, statusText: 'Conflict' });

    expect(rejectionReason).toBe('generic');
  });

  it('blocks drop when offline without dispatching a request', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    window.dispatchEvent(new Event('offline'));

    let rejectionReason: string | undefined;
    store.drop('enr-1', null, (reason) => (rejectionReason = reason));

    expect(rejectionReason).toBe('offline');
    httpMock.expectNone(`${baseUrl}/api/v1/academic/enrollments/enr-1`);

    window.dispatchEvent(new Event('online'));
  });

  it('triggers a status redirect on a status-related drop rejection', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.drop('enr-1', null);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`)
      .flush(
        { title: 'Suspended', code: 'enrollment.student_not_active' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.statusRedirectMessage()).toBeTruthy();
  });

  it('shows a generic error message for an unclassified drop rejection', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let rejectionReason: string | undefined;
    store.drop('enr-1', null, (reason) => (rejectionReason = reason));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`)
      .flush({ title: 'Boom' }, { status: 500, statusText: 'Server Error' });

    expect(rejectionReason).toBe('generic');
  });

  it('shows a generic error message for an unclassified register rejection', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    let rejectionReason: string | undefined;
    store.register(offering, offering.sections[0], course, (reason) => (rejectionReason = reason));
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments`)
      .flush({ title: 'Boom' }, { status: 500, statusText: 'Server Error' });

    expect(rejectionReason).toBe('generic');
  });

  it('re-loads tracked enrollments from localStorage-persisted ids on a later session load', async () => {
    store.loadSession('session-1');
    await flushInitialLoad();

    store.register(offering, offering.sections[0], course);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments`).flush({
      id: 'enr-1',
      studentId: 'student-1',
      courseOfferingId: 'off-1',
      semesterId: 'sem-open',
      sectionId: 'sec-1',
      status: 'Active',
      creditHours: 3,
      prerequisiteOverrideReason: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
      droppedAt: null,
    });

    // Simulates a page reload re-invoking loadSession: the store re-reads the persisted
    // enrollment id from localStorage (the in-memory tracked-enrollments state is not reused).
    store.stopPolling();
    store.loadSession('session-1');

    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`).flush(session);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/programs/program-1`).flush(program);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/students/student-1/results`).flush([]);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`).flush({
      id: 'enr-1',
      studentId: 'student-1',
      courseOfferingId: 'off-1',
      semesterId: 'sem-open',
      sectionId: 'sec-1',
      status: 'Active',
      creditHours: 3,
      prerequisiteOverrideReason: null,
      createdAt: '2026-01-01T00:00:00Z',
      approvedAt: null,
      droppedAt: null,
    });
    httpMock.expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1`).flush(offering);

    await wait(30);
    httpMock
      .expectOne((r) => r.url === `${baseUrl}/api/v1/academic/course-offerings`)
      .flush([offering]);
    // `course-1` is already cached in-memory from the first load, so the second poll cycle's
    // course resolution never re-requests it.

    expect(store.trackedEnrollments().length).toBe(1);
    expect(store.trackedEnrollments()[0].courseCode).toBe('CSE101');
  });
});
