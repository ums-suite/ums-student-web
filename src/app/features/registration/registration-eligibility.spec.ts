import type { CourseDto, SectionDto, SemesterDto } from '../../core/api/academic.types';
import type { ScheduleSelection } from './registration.types';
import {
  buildEligibility,
  classifyEnrollmentError,
  computeCreditLimitUsage,
  computeMissingPrerequisites,
  computeRegistrationWindowStatus,
  doSectionsConflict,
  findTimetableConflicts,
  hasBlockingClientSideIssue,
  isStatusRejection,
} from './registration-eligibility';

function semester(partial: Partial<SemesterDto> = {}): SemesterDto {
  return {
    id: 'sem-1',
    name: 'Fall 2026',
    registrationStart: '2026-08-01T00:00:00Z',
    registrationEnd: '2026-08-15T00:00:00Z',
    dropStart: '2026-08-16T00:00:00Z',
    dropEnd: '2026-08-31T00:00:00Z',
    ...partial,
  };
}

describe('computeRegistrationWindowStatus', () => {
  it('is open strictly within the window', () => {
    const status = computeRegistrationWindowStatus(semester(), new Date('2026-08-07T00:00:00Z'));
    expect(status).toBe('open');
  });

  it('is open exactly at the start boundary (inclusive)', () => {
    const status = computeRegistrationWindowStatus(semester(), new Date('2026-08-01T00:00:00Z'));
    expect(status).toBe('open');
  });

  it('is open exactly at the end boundary (inclusive)', () => {
    const status = computeRegistrationWindowStatus(semester(), new Date('2026-08-15T00:00:00Z'));
    expect(status).toBe('open');
  });

  it('is closed before the window opens', () => {
    const status = computeRegistrationWindowStatus(semester(), new Date('2026-07-31T23:59:59Z'));
    expect(status).toBe('closed');
  });

  it('is closed after the window ends', () => {
    const status = computeRegistrationWindowStatus(semester(), new Date('2026-08-15T00:00:01Z'));
    expect(status).toBe('closed');
  });

  it('is unknown for malformed dates', () => {
    const status = computeRegistrationWindowStatus(
      semester({ registrationStart: 'not-a-date' }),
      new Date(),
    );
    expect(status).toBe('unknown');
  });
});

function course(partial: Partial<CourseDto> = {}): CourseDto {
  return {
    id: 'course-1',
    code: 'CSE101',
    title: 'Intro to Programming',
    creditHours: 3,
    prerequisites: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('computeMissingPrerequisites', () => {
  it('returns an empty list when there are no prerequisites', () => {
    expect(computeMissingPrerequisites(course({ prerequisites: [] }), new Set())).toEqual([]);
  });

  it('returns every prerequisite not in the completed set', () => {
    const missing = computeMissingPrerequisites(
      course({ prerequisites: ['pre-1', 'pre-2'] }),
      new Set(['pre-1']),
    );
    expect(missing).toEqual(['pre-2']);
  });

  it('returns an empty list once every prerequisite is completed', () => {
    const missing = computeMissingPrerequisites(
      course({ prerequisites: ['pre-1', 'pre-2'] }),
      new Set(['pre-1', 'pre-2']),
    );
    expect(missing).toEqual([]);
  });
});

function section(partial: Partial<SectionDto> = {}): SectionDto {
  return { id: 'sec-1', code: 'A', dayOfWeek: 1, start: '09:00:00', end: '10:30:00', ...partial };
}

function selection(partial: Partial<ScheduleSelection> = {}): ScheduleSelection {
  return {
    offeringId: 'off-1',
    sectionId: 'sec-1',
    courseCode: 'CSE101',
    courseTitle: 'Intro to Programming',
    creditHours: 3,
    section: section(),
    ...partial,
  };
}

describe('computeCreditLimitUsage', () => {
  it('is ok when total is within the limit', () => {
    const result = computeCreditLimitUsage([selection({ creditHours: 3 })], 3, 18);
    expect(result).toEqual({ creditsUsed: 6, creditsMax: 18, ok: true });
  });

  it('is ok exactly at the limit', () => {
    const result = computeCreditLimitUsage([], 18, 18);
    expect(result.ok).toBeTrue();
  });

  it('is not ok just over the limit', () => {
    const result = computeCreditLimitUsage([selection({ creditHours: 16 })], 3, 18);
    expect(result.ok).toBeFalse();
    expect(result.creditsUsed).toBe(19);
  });
});

describe('doSectionsConflict', () => {
  it('does not conflict on different days', () => {
    expect(doSectionsConflict(section({ dayOfWeek: 1 }), section({ dayOfWeek: 2 }))).toBeFalse();
  });

  it('conflicts on the same day with overlapping times', () => {
    const a = section({ dayOfWeek: 1, start: '09:00:00', end: '10:30:00' });
    const b = section({ dayOfWeek: 1, start: '10:00:00', end: '11:00:00' });
    expect(doSectionsConflict(a, b)).toBeTrue();
  });

  it('does not conflict on the same day with back-to-back (non-overlapping) times', () => {
    const a = section({ dayOfWeek: 1, start: '09:00:00', end: '10:00:00' });
    const b = section({ dayOfWeek: 1, start: '10:00:00', end: '11:00:00' });
    expect(doSectionsConflict(a, b)).toBeFalse();
  });

  it('conflicts when one section fully contains another', () => {
    const a = section({ dayOfWeek: 1, start: '09:00:00', end: '12:00:00' });
    const b = section({ dayOfWeek: 1, start: '10:00:00', end: '11:00:00' });
    expect(doSectionsConflict(a, b)).toBeTrue();
  });
});

describe('findTimetableConflicts', () => {
  it('returns only the conflicting selections', () => {
    const conflicting = selection({
      sectionId: 'sec-conflict',
      section: section({ dayOfWeek: 1, start: '09:00:00', end: '10:30:00' }),
    });
    const clean = selection({
      sectionId: 'sec-clean',
      section: section({ dayOfWeek: 3, start: '09:00:00', end: '10:30:00' }),
    });
    const candidate = section({ dayOfWeek: 1, start: '10:00:00', end: '11:00:00' });

    const result = findTimetableConflicts([conflicting, clean], candidate);
    expect(result).toEqual([conflicting]);
  });

  it('returns an empty list when nothing conflicts', () => {
    const clean = selection({ section: section({ dayOfWeek: 3 }) });
    const candidate = section({ dayOfWeek: 1 });
    expect(findTimetableConflicts([clean], candidate)).toEqual([]);
  });
});

describe('buildEligibility', () => {
  it('is fully eligible when every check passes', () => {
    const result = buildEligibility({
      course: course({ prerequisites: [] }),
      section: section({ dayOfWeek: 5 }),
      candidateCreditHours: 3,
      completedCourseIds: new Set(),
      currentSelections: [],
      maxCreditsPerSemester: 18,
      hasAvailableSeats: true,
    });

    expect(result.prerequisitesSatisfied).toBeTrue();
    expect(result.creditLimitOk).toBeTrue();
    expect(result.timetableConflict).toBeFalse();
    expect(result.seatsAvailable).toBeTrue();
  });

  it('flags missing prerequisites, exceeded credit limit, and a timetable conflict together', () => {
    const conflict = selection({
      section: section({ dayOfWeek: 2, start: '09:00:00', end: '10:00:00' }),
    });

    const result = buildEligibility({
      course: course({ prerequisites: ['pre-1'] }),
      section: section({ dayOfWeek: 2, start: '09:30:00', end: '10:30:00' }),
      candidateCreditHours: 20,
      completedCourseIds: new Set(),
      currentSelections: [conflict],
      maxCreditsPerSemester: 18,
      hasAvailableSeats: false,
    });

    expect(result.prerequisitesSatisfied).toBeFalse();
    expect(result.missingPrerequisiteCourseIds).toEqual(['pre-1']);
    expect(result.creditLimitOk).toBeFalse();
    expect(result.timetableConflict).toBeTrue();
    expect(result.conflictingSelections.length).toBe(1);
    expect(result.seatsAvailable).toBeFalse();
  });

  it('treats a null course (not yet resolved) as having no prerequisites to check', () => {
    const result = buildEligibility({
      course: null,
      section: section(),
      candidateCreditHours: 3,
      completedCourseIds: new Set(),
      currentSelections: [],
      maxCreditsPerSemester: 18,
      hasAvailableSeats: true,
    });
    expect(result.prerequisitesSatisfied).toBeTrue();
  });
});

describe('hasBlockingClientSideIssue', () => {
  it('is false when everything passes, seats or not (seat gauge never gates)', () => {
    const eligible = buildEligibility({
      course: course(),
      section: section(),
      candidateCreditHours: 3,
      completedCourseIds: new Set(),
      currentSelections: [],
      maxCreditsPerSemester: 18,
      hasAvailableSeats: false,
    });
    expect(hasBlockingClientSideIssue(eligible)).toBeFalse();
  });

  it('is true when prerequisites are missing', () => {
    const result = buildEligibility({
      course: course({ prerequisites: ['pre-1'] }),
      section: section(),
      candidateCreditHours: 3,
      completedCourseIds: new Set(),
      currentSelections: [],
      maxCreditsPerSemester: 18,
      hasAvailableSeats: true,
    });
    expect(hasBlockingClientSideIssue(result)).toBeTrue();
  });
});

describe('classifyEnrollmentError', () => {
  const cases: readonly [string, string][] = [
    ['enrollment.prerequisite_not_met', 'prerequisite'],
    ['enrollment.credit_limit_exceeded', 'creditLimit'],
    ['enrollment.timetable_conflict', 'timetableConflict'],
    ['enrollment.seat_no_longer_available', 'seatUnavailable'],
    ['enrollment.registration_window_closed', 'windowClosed'],
    ['enrollment.drop_window_closed', 'windowClosed'],
    ['enrollment.student_not_active', 'statusRejection'],
    ['enrollment.no_student_record', 'statusRejection'],
    ['enrollment.not_owned', 'statusRejection'],
  ];

  for (const [code, expected] of cases) {
    it(`classifies "${code}" as "${expected}"`, () => {
      expect(classifyEnrollmentError({ status: 400, message: 'x', code })).toBe(expected as never);
    });
  }

  it('classifies an unknown code as generic', () => {
    expect(classifyEnrollmentError({ status: 400, message: 'x', code: 'something.else' })).toBe(
      'generic',
    );
  });

  it('classifies a missing code as generic', () => {
    expect(classifyEnrollmentError({ status: 500, message: 'x' })).toBe('generic');
  });
});

describe('isStatusRejection', () => {
  it('is true only for statusRejection', () => {
    expect(isStatusRejection('statusRejection')).toBeTrue();
    expect(isStatusRejection('prerequisite')).toBeFalse();
    expect(isStatusRejection('generic')).toBeFalse();
  });
});
