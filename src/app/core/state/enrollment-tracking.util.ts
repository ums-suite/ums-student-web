const STORAGE_PREFIX = 'ums-student-web:registration:enrollments:';

/**
 * Same-browser `Enrollment` id tracking, shared between {@link RegistrationStore} (which writes
 * it, per its own class doc's "confirmed gap #2: no 'list my enrollments' endpoint exists") and
 * `RoutineStore` (SWEB-16, which only ever reads it -- a student's weekly routine is derived from
 * the same set of enrollments Registration already knows about in this browser, not a second,
 * independently-tracked list). Pulled out of `registration.store.ts` into its own module so the
 * two features share one storage-key convention instead of Routine having to guess/duplicate
 * Registration's private key format.
 */
export function enrollmentStorageKey(studentId: string, semesterId: string): string {
  return `${STORAGE_PREFIX}${studentId}:${semesterId}`;
}

export function readTrackedEnrollmentIds(studentId: string, semesterId: string): readonly string[] {
  try {
    const raw = localStorage.getItem(enrollmentStorageKey(studentId, semesterId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeTrackedEnrollmentIds(
  studentId: string,
  semesterId: string,
  ids: readonly string[],
): void {
  try {
    localStorage.setItem(enrollmentStorageKey(studentId, semesterId), JSON.stringify(ids));
  } catch {
    // Best-effort only -- a private-browsing/storage-disabled session simply loses same-browser
    // enrollment tracking, never breaks the calling feature itself.
  }
}
