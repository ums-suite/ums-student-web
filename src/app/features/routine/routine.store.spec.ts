import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/config/app-config';
import { writeTrackedEnrollmentIds } from '../../core/state/enrollment-tracking.util';
import { RoutineStore } from './routine.store';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const enrollment = {
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
  exams: [
    { id: 'exam-1', name: 'Midterm', assessments: [{ id: 'a1', name: 'Written', weight: 1 }] },
  ],
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

describe('RoutineStore', () => {
  let store: RoutineStore;
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
    store = TestBed.inject(RoutineStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts idle with no blocks', () => {
    expect(store.loading()).toBeFalse();
    expect(store.blocks()).toEqual([]);
  });

  it('builds routine blocks + exam groups from tracked enrollments', async () => {
    writeTrackedEnrollmentIds('student-1', 'sem-open', ['enr-1']);

    store.loadSession('session-1');
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`).flush(session);
    await wait(10);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`).flush(enrollment);
    await wait(10);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1`).flush(offering);
    await wait(10);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/courses/course-1`).flush(course);

    expect(store.loading()).toBeFalse();
    expect(store.blocks().length).toBe(1);
    expect(store.blocks()[0]).toEqual(
      jasmine.objectContaining({ courseCode: 'CSE101', dayOfWeek: 1, roomId: null }),
    );
    expect(store.examGroups().length).toBe(1);
    expect(store.examGroups()[0].examName).toBe('Midterm');
    expect(store.fetchedAt()).not.toBeNull();
  });

  it('excludes a Dropped enrollment from the routine', async () => {
    writeTrackedEnrollmentIds('student-1', 'sem-open', ['enr-1']);

    store.loadSession('session-1');
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`).flush(session);
    await wait(10);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`)
      .flush({ ...enrollment, status: 'Dropped' });

    expect(store.blocks()).toEqual([]);
    expect(store.loading()).toBeFalse();
  });

  it('resolves to an empty routine when no enrollments are tracked for this browser', async () => {
    store.loadSession('session-1');
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock.expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`).flush(session);

    expect(store.blocks()).toEqual([]);
    expect(store.loading()).toBeFalse();
  });

  it('sets an error when the session fetch fails', async () => {
    store.loadSession('session-1');
    httpMock.expectOne(`${baseUrl}/api/v1/student/students/me`).flush(student);
    httpMock
      .expectOne(`${baseUrl}/api/v1/academic/academic-sessions/session-1`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBeFalse();
  });

  it('loads the building/room directory', async () => {
    store.loadBuildings();
    httpMock
      .expectOne(`${baseUrl}/api/v1/organization/buildings/`)
      .flush({
        items: [{ id: 'b1', campusId: 'c1', name: 'Main Hall', code: 'MH', createdAt: '' }],
        totalCount: 1,
        skip: 0,
        take: 20,
      });

    expect(store.buildings().length).toBe(1);
    expect(store.roomDirectoryLoading()).toBeFalse();

    store.loadRoomsForBuilding('b1');
    httpMock
      .expectOne(`${baseUrl}/api/v1/organization/buildings/b1/rooms`)
      .flush({
        items: [
          {
            id: 'r1',
            buildingId: 'b1',
            name: '301',
            capacity: 40,
            roomType: 'classroom',
            createdAt: '',
          },
        ],
        totalCount: 1,
        skip: 0,
        take: 20,
      });

    expect(store.rooms().length).toBe(1);
    expect(store.rooms()[0].name).toBe('301');
  });

  it('degrades the room directory gracefully on a failed fetch', () => {
    store.loadBuildings();
    httpMock
      .expectOne(`${baseUrl}/api/v1/organization/buildings/`)
      .flush({ title: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(store.roomDirectoryLoading()).toBeFalse();
    expect(store.buildings()).toEqual([]);
  });
});
