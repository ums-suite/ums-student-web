import {
  GRID_END_MINUTES,
  GRID_SLOT_MINUTES,
  GRID_START_MINUTES,
  TOTAL_GRID_ROWS,
  buildTimeLabels,
  computeGridPlacement,
  doBlocksOverlap,
  minutesSinceMidnight,
  routineColorIndex,
} from './routine.logic';

describe('routine.logic', () => {
  describe('minutesSinceMidnight', () => {
    it('converts HH:mm:ss to minutes', () => {
      expect(minutesSinceMidnight('09:30:00')).toBe(570);
      expect(minutesSinceMidnight('00:00:00')).toBe(0);
      expect(minutesSinceMidnight('23:45:00')).toBe(1425);
    });
  });

  describe('computeGridPlacement', () => {
    it('places a normal in-window block at the correct row/span/column', () => {
      const placement = computeGridPlacement({
        start: '09:00:00',
        end: '10:30:00',
        dayOfWeek: 2,
      });
      // (9:00 - 7:00) / 30 = 4 -> rowStart 5; duration 90min / 30 = 3 rows
      expect(placement.rowStart).toBe(5);
      expect(placement.rowSpan).toBe(3);
      expect(placement.dayColumn).toBe(3);
    });

    it('clamps a block starting before the grid window to the visible start', () => {
      const placement = computeGridPlacement({ start: '05:00:00', end: '08:00:00', dayOfWeek: 0 });
      expect(placement.rowStart).toBe(1);
    });

    it('clamps a block ending after the grid window', () => {
      const placement = computeGridPlacement({ start: '20:30:00', end: '23:00:00', dayOfWeek: 5 });
      expect(placement.rowStart).toBeGreaterThan(0);
      expect(placement.rowSpan).toBeGreaterThanOrEqual(1);
    });

    it('never returns a zero/negative span even for a degenerate zero-length time range', () => {
      const placement = computeGridPlacement({ start: '09:00:00', end: '09:00:00', dayOfWeek: 1 });
      expect(placement.rowSpan).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildTimeLabels', () => {
    it('builds one label per 30-minute slot across the whole window', () => {
      const labels = buildTimeLabels();
      expect(labels.length).toBe(TOTAL_GRID_ROWS);
      expect(labels[0]).toBe('07:00');
      expect(labels[1]).toBe('07:30');
      expect(labels[labels.length - 1]).toBe('20:30');
    });

    it('derives TOTAL_GRID_ROWS consistently from the window constants', () => {
      expect(TOTAL_GRID_ROWS).toBe((GRID_END_MINUTES - GRID_START_MINUTES) / GRID_SLOT_MINUTES);
    });
  });

  describe('doBlocksOverlap', () => {
    const base = { id: 's1', code: 'A', dayOfWeek: 1, start: '09:00:00', end: '10:00:00' };

    it('is false for different days', () => {
      expect(doBlocksOverlap(base, { ...base, dayOfWeek: 2 })).toBeFalse();
    });

    it('is true for overlapping same-day ranges', () => {
      expect(doBlocksOverlap(base, { ...base, start: '09:30:00', end: '11:00:00' })).toBeTrue();
    });

    it('is false for adjacent, non-overlapping same-day ranges', () => {
      expect(doBlocksOverlap(base, { ...base, start: '10:00:00', end: '11:00:00' })).toBeFalse();
    });
  });

  describe('routineColorIndex', () => {
    it('is deterministic for the same course id', () => {
      expect(routineColorIndex('course-1')).toBe(routineColorIndex('course-1'));
    });

    it('stays within the palette bounds', () => {
      for (const id of ['a', 'bb', 'ccc', 'course-42', '']) {
        const index = routineColorIndex(id);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(6);
      }
    });
  });
});
