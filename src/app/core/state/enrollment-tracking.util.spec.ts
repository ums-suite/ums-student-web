import {
  enrollmentStorageKey,
  readTrackedEnrollmentIds,
  writeTrackedEnrollmentIds,
} from './enrollment-tracking.util';

describe('enrollment-tracking.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('builds a namespaced key from studentId + semesterId', () => {
    expect(enrollmentStorageKey('s1', 'sem1')).toBe(
      'ums-student-web:registration:enrollments:s1:sem1',
    );
  });

  it('reads an empty array when nothing was ever written', () => {
    expect(readTrackedEnrollmentIds('s1', 'sem1')).toEqual([]);
  });

  it('round-trips written ids', () => {
    writeTrackedEnrollmentIds('s1', 'sem1', ['e1', 'e2']);
    expect(readTrackedEnrollmentIds('s1', 'sem1')).toEqual(['e1', 'e2']);
  });

  it('keeps different students/semesters isolated', () => {
    writeTrackedEnrollmentIds('s1', 'sem1', ['e1']);
    writeTrackedEnrollmentIds('s2', 'sem1', ['e2']);
    writeTrackedEnrollmentIds('s1', 'sem2', ['e3']);
    expect(readTrackedEnrollmentIds('s1', 'sem1')).toEqual(['e1']);
    expect(readTrackedEnrollmentIds('s2', 'sem1')).toEqual(['e2']);
    expect(readTrackedEnrollmentIds('s1', 'sem2')).toEqual(['e3']);
  });

  it('degrades to an empty array on malformed stored JSON', () => {
    localStorage.setItem(enrollmentStorageKey('s1', 'sem1'), '{not json');
    expect(readTrackedEnrollmentIds('s1', 'sem1')).toEqual([]);
  });

  it('write is best-effort and never throws even if storage fails', () => {
    const original = localStorage.setItem.bind(localStorage);
    spyOn(localStorage, 'setItem').and.callFake(() => {
      throw new DOMException('quota exceeded');
    });
    expect(() => writeTrackedEnrollmentIds('s1', 'sem1', ['e1'])).not.toThrow();
    (localStorage.setItem as jasmine.Spy).and.callFake(original);
  });
});
