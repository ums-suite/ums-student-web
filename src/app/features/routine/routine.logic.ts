import type { SectionDto } from '../../core/api/academic.types';
import type { RoutineBlock, RoutineGridPlacement } from './routine.types';

/** The grid's visible time window and row granularity (SWEB-16, §7 "a full week grid... each class a colored block sized to its actual duration"). */
export const GRID_START_MINUTES = 7 * 60; // 07:00
export const GRID_END_MINUTES = 21 * 60; // 21:00
export const GRID_SLOT_MINUTES = 30;

/** `"HH:mm:ss"` -> minutes since midnight. Pure, DI-free (test-coverage NFR). */
export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts a block's real start/end time into a CSS-grid row start/span within the visible window,
 * clamped so a class that starts before {@link GRID_START_MINUTES} or ends after
 * {@link GRID_END_MINUTES} still renders (clipped to the visible edge) rather than disappearing or
 * throwing.
 */
export function computeGridPlacement(
  block: Pick<RoutineBlock, 'start' | 'end' | 'dayOfWeek'>,
): RoutineGridPlacement {
  const startMinutes = Math.max(GRID_START_MINUTES, minutesSinceMidnight(block.start));
  const endMinutes = Math.min(GRID_END_MINUTES, minutesSinceMidnight(block.end));
  const clampedDuration = Math.max(GRID_SLOT_MINUTES, endMinutes - startMinutes);

  const rowStart = 1 + Math.floor((startMinutes - GRID_START_MINUTES) / GRID_SLOT_MINUTES);
  const rowSpan = Math.max(1, Math.ceil(clampedDuration / GRID_SLOT_MINUTES));

  return { rowStart, rowSpan, dayColumn: block.dayOfWeek + 1 };
}

/** Every 30-minute row label from {@link GRID_START_MINUTES} to {@link GRID_END_MINUTES}, e.g. `"07:00"`, `"07:30"`, ... */
export function buildTimeLabels(): readonly string[] {
  const labels: string[] = [];
  for (let m = GRID_START_MINUTES; m < GRID_END_MINUTES; m += GRID_SLOT_MINUTES) {
    const hours = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (m % 60).toString().padStart(2, '0');
    labels.push(`${hours}:${minutes}`);
  }
  return labels;
}

export const TOTAL_GRID_ROWS = (GRID_END_MINUTES - GRID_START_MINUTES) / GRID_SLOT_MINUTES;

/** Whether two blocks meet on the same day with overlapping time ranges -- reused by the grid to fan out same-slot conflicts into side-by-side columns rather than stacking them illegibly. */
export function doBlocksOverlap(a: SectionDto, b: SectionDto): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) {
    return false;
  }
  return a.start < b.end && b.start < a.end;
}

/**
 * A small, stable (non-cryptographic) string hash -- same technique as
 * `FacultyAccentService`'s own `hashToIndex`, duplicated here rather than imported since the two
 * services pick from unrelated palettes for unrelated purposes (faculty theming vs. per-course
 * routine-block coloring).
 */
function hashToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

/** A small, curated set of token-driven CSS classes (`routine.component.scss` defines `--sweb-routine-color-N`) -- deterministic per course so the same course always reads as the same color across the week. */
export const ROUTINE_COLOR_COUNT = 6;

export function routineColorIndex(courseId: string): number {
  return hashToIndex(courseId, ROUTINE_COLOR_COUNT);
}
