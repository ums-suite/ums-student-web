import {
  buildGpaTrendPoints,
  buildSemesterGroups,
  computeUnofficialAverageScore,
} from './results.logic';
import type { StudentResultRowDto } from '../../core/api/academic.types';

function row(overrides: Partial<StudentResultRowDto> = {}): StudentResultRowDto {
  return {
    enrollmentId: 'enr-1',
    courseOfferingId: 'off-1',
    courseId: 'course-1',
    semesterId: 'sem-1',
    calculatedScore: 80,
    letterGrade: 'A',
    creditHours: 3,
    publishedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('results.logic', () => {
  describe('computeUnofficialAverageScore', () => {
    it('returns 0 for an empty list', () => {
      expect(computeUnofficialAverageScore([])).toBe(0);
    });

    it('averages calculatedScore across rows', () => {
      expect(
        computeUnofficialAverageScore([row({ calculatedScore: 80 }), row({ calculatedScore: 90 })]),
      ).toBe(85);
    });
  });

  describe('buildSemesterGroups', () => {
    it('returns an empty array for no results', () => {
      expect(buildSemesterGroups([])).toEqual([]);
    });

    it('groups rows by semesterId', () => {
      const groups = buildSemesterGroups([
        row({ semesterId: 'sem-1', calculatedScore: 80 }),
        row({ semesterId: 'sem-1', calculatedScore: 90 }),
        row({ semesterId: 'sem-2', calculatedScore: 70 }),
      ]);

      expect(groups.length).toBe(2);
      const semOne = groups.find((g) => g.semesterId === 'sem-1');
      expect(semOne?.courses.length).toBe(2);
      expect(semOne?.averageScore).toBe(85);
      expect(semOne?.creditHoursTotal).toBe(6);
    });

    it('orders groups chronologically by earliest publishedAt, not by insertion order', () => {
      const groups = buildSemesterGroups([
        row({ semesterId: 'sem-later', publishedAt: '2026-06-01T00:00:00Z' }),
        row({ semesterId: 'sem-earlier', publishedAt: '2026-01-01T00:00:00Z' }),
      ]);

      expect(groups[0].semesterId).toBe('sem-earlier');
      expect(groups[0].ordinalLabel).toBe('Semester 1');
      expect(groups[1].semesterId).toBe('sem-later');
      expect(groups[1].ordinalLabel).toBe('Semester 2');
    });

    it('uses the earliest publishedAt within a semester group for ordering, not the first row seen', () => {
      const groups = buildSemesterGroups([
        row({ semesterId: 'sem-1', publishedAt: '2026-03-01T00:00:00Z' }),
        row({ semesterId: 'sem-1', publishedAt: '2026-01-01T00:00:00Z' }),
        row({ semesterId: 'sem-2', publishedAt: '2026-02-01T00:00:00Z' }),
      ]);

      expect(groups[0].semesterId).toBe('sem-1');
      expect(groups[1].semesterId).toBe('sem-2');
    });

    it('never mutates or drops a row -- every published row appears in exactly one group', () => {
      const rows = [
        row({ semesterId: 'sem-1', courseId: 'c1' }),
        row({ semesterId: 'sem-2', courseId: 'c2' }),
      ];
      const groups = buildSemesterGroups(rows);
      const totalCourses = groups.reduce((sum, g) => sum + g.courses.length, 0);
      expect(totalCourses).toBe(rows.length);
    });
  });

  describe('buildGpaTrendPoints', () => {
    it('maps one point per semester group, preserving order', () => {
      const groups = buildSemesterGroups([
        row({ semesterId: 'sem-1', publishedAt: '2026-01-01T00:00:00Z', calculatedScore: 60 }),
        row({ semesterId: 'sem-2', publishedAt: '2026-06-01T00:00:00Z', calculatedScore: 90 }),
      ]);
      const points = buildGpaTrendPoints(groups);

      expect(points.length).toBe(2);
      expect(points[0]).toEqual({
        semesterId: 'sem-1',
        ordinalLabel: 'Semester 1',
        averageScore: 60,
      });
      expect(points[1]).toEqual({
        semesterId: 'sem-2',
        ordinalLabel: 'Semester 2',
        averageScore: 90,
      });
    });

    it('returns an empty array when there are no groups', () => {
      expect(buildGpaTrendPoints([])).toEqual([]);
    });
  });
});
