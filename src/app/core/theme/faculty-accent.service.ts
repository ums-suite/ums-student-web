import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * A student's own faculty color tints their dashboard header, cards, and course chips (SWEB-2,
 * requirement-spec.md §7 Visual direction: "a restrained but real accent-color system per
 * program/faculty... small, cheap, and makes the app feel like *theirs*").
 *
 * Deliberately NOT a full theme fork or a new `@ums/design-system` token -- the design system's
 * own semantic palette has no per-faculty concept, and forking a theme per faculty would violate
 * ADR-0017's "one visual/interaction language across all six apps". Instead, this service picks
 * one of a small, curated, WCAG-AA-checked accent palette deterministically by faculty id/code and
 * writes it as a small app-owned CSS custom property pair (`--sweb-faculty-accent`,
 * `--sweb-faculty-accent-soft`) on `<html>` -- consuming SCSS reads these two app-owned properties
 * directly (never a raw `@ums/design-system` token var, which the consumption-contract lint rules
 * already block).
 */
@Injectable({ providedIn: 'root' })
export class FacultyAccentService {
  private readonly document = inject(DOCUMENT);

  /** Curated, contrast-checked accent hues -- deliberately small so every one reads intentional, not random. */
  private static readonly PALETTE: readonly { accent: string; soft: string }[] = [
    { accent: '#2563eb', soft: '#dbeafe' }, // blue
    { accent: '#7c3aed', soft: '#ede9fe' }, // violet
    { accent: '#0d9488', soft: '#ccfbf1' }, // teal
    { accent: '#c2410c', soft: '#ffedd5' }, // amber-orange
    { accent: '#be123c', soft: '#ffe4e6' }, // rose
    { accent: '#4d7c0f', soft: '#ecfccb' }, // olive
  ];

  private readonly currentFacultyKey = signal<string | null>(null);
  readonly facultyKey = this.currentFacultyKey.asReadonly();

  /** Applies (or clears, on `null`) the accent derived from `facultyKey` -- a faculty id or code, any stable string. */
  applyForFaculty(facultyKey: string | null): void {
    this.currentFacultyKey.set(facultyKey);
    const root = this.document.documentElement;

    if (!facultyKey) {
      root.style.removeProperty('--sweb-faculty-accent');
      root.style.removeProperty('--sweb-faculty-accent-soft');
      return;
    }

    const { accent, soft } =
      FacultyAccentService.PALETTE[hashToIndex(facultyKey, FacultyAccentService.PALETTE.length)];
    root.style.setProperty('--sweb-faculty-accent', accent);
    root.style.setProperty('--sweb-faculty-accent-soft', soft);
  }
}

/** A small, stable (non-cryptographic) string hash -- deterministic across sessions/devices for the same faculty. */
function hashToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}
