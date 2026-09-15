import type { StudentRequestType } from '../api/student.types';

const STORAGE_PREFIX = 'ums-student-web:student-requests:';

/**
 * Same-browser `StudentRequest` id tracking (SWEB-19/28) -- mirrors
 * `enrollment-tracking.util.ts`'s exact pattern for the exact same reason: `Student`'s own
 * repository has no "list my StudentRequests" method at all (confirmed gap, only get-by-id and an
 * internal open-request dedup check exist), so every request this app itself submits is tracked
 * here, keyed by `(studentId, requestType)`, and re-fetched by id on load. A `StudentRequest`
 * submitted from a different browser/device is invisible to this app, same class of limitation as
 * `RegistrationStore`'s own documented one.
 */
function storageKey(studentId: string, requestType: StudentRequestType): string {
  return `${STORAGE_PREFIX}${studentId}:${requestType}`;
}

export function readTrackedRequestIds(
  studentId: string,
  requestType: StudentRequestType,
): readonly string[] {
  try {
    const raw = localStorage.getItem(storageKey(studentId, requestType));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeTrackedRequestIds(
  studentId: string,
  requestType: StudentRequestType,
  ids: readonly string[],
): void {
  try {
    localStorage.setItem(storageKey(studentId, requestType), JSON.stringify(ids));
  } catch {
    // Best-effort only, matching enrollment-tracking.util.ts's own documented trade-off.
  }
}

export function addTrackedRequestId(
  studentId: string,
  requestType: StudentRequestType,
  id: string,
): void {
  writeTrackedRequestIds(studentId, requestType, [
    ...readTrackedRequestIds(studentId, requestType),
    id,
  ]);
}
