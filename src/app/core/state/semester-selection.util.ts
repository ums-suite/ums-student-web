import { computeRegistrationWindowStatus } from '../../features/registration/registration-eligibility';
import type { SemesterDto } from '../api/academic.types';

/**
 * No "current semester" concept exists server-side (confirmed gap, `academic.types.ts`
 * `SemesterDto` doc) -- shared by {@link RegistrationStore} and `RoutineStore` (SWEB-16) so both
 * features agree on the exact same "which semester is 'now'" heuristic: prefer whichever
 * semester's registration window is open right now, falling back to the most recently-starting
 * one. Pulled out of `registration.store.ts` so a second feature never has to re-derive or drift
 * from this same rule.
 */
export function selectActiveSemester(
  semesters: readonly SemesterDto[],
  now: Date,
): SemesterDto | null {
  if (semesters.length === 0) {
    return null;
  }
  const open = semesters.find((s) => computeRegistrationWindowStatus(s, now) === 'open');
  if (open) {
    return open;
  }
  return [...semesters].sort((a, b) => b.registrationStart.localeCompare(a.registrationStart))[0];
}
