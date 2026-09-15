import type { StudentResultRowDto } from '../../core/api/academic.types';
import type { GpaTrendPoint, SemesterGradeGroup } from './results.types';

/**
 * Pure grade/GPA-trend grouping logic (SWEB-17/18, test-coverage NFR: "≥85% on stores/validators
 * (GPA/credit-limit logic)"). Deliberately free of HttpClient/DI/signals, mirroring
 * `registration-eligibility.ts`'s own "pure logic lives outside the store" convention.
 *
 * Every input row here is assumed already Published-only (Invariant §8.1 enforced server-side,
 * see `results.types.ts`'s own doc) -- this module never re-derives or second-guesses that, it
 * only groups/aggregates what it's given.
 */

/** Groups published rows by `semesterId`, ordered chronologically by each group's earliest `publishedAt` (oldest first) -- see `SemesterGradeGroup.ordinalLabel`'s own doc for why this is an ordinal, not a resolved semester name. */
export function buildSemesterGroups(
  results: readonly StudentResultRowDto[],
): readonly SemesterGradeGroup[] {
  const bySemester = new Map<string, StudentResultRowDto[]>();
  for (const row of results) {
    const existing = bySemester.get(row.semesterId);
    if (existing) {
      existing.push(row);
    } else {
      bySemester.set(row.semesterId, [row]);
    }
  }

  const groups = Array.from(bySemester.entries()).map(([semesterId, courses]) => ({
    semesterId,
    courses,
    earliestPublishedAt: courses.reduce(
      (min, c) => (c.publishedAt < min ? c.publishedAt : min),
      courses[0].publishedAt,
    ),
  }));

  groups.sort((a, b) => a.earliestPublishedAt.localeCompare(b.earliestPublishedAt));

  return groups.map((group, index) => ({
    semesterId: group.semesterId,
    ordinalLabel: `Semester ${index + 1}`,
    courses: group.courses,
    averageScore: computeUnofficialAverageScore(group.courses),
    creditHoursTotal: group.courses.reduce((sum, c) => sum + c.creditHours, 0),
  }));
}

/**
 * A plain arithmetic mean of `calculatedScore` across the given rows -- **never authoritative**
 * (Invariant §8.4), used only for the unofficial per-semester preview. The real, authoritative
 * aggregate is always `TranscriptDto.overallAverageScore`, computed by `Academic` itself.
 */
export function computeUnofficialAverageScore(rows: readonly StudentResultRowDto[]): number {
  if (rows.length === 0) {
    return 0;
  }
  return rows.reduce((sum, r) => sum + r.calculatedScore, 0) / rows.length;
}

/** SWEB-18: one trend point per semester group, in the same chronological order. */
export function buildGpaTrendPoints(
  groups: readonly SemesterGradeGroup[],
): readonly GpaTrendPoint[] {
  return groups.map((group) => ({
    semesterId: group.semesterId,
    ordinalLabel: group.ordinalLabel,
    averageScore: group.averageScore,
  }));
}
