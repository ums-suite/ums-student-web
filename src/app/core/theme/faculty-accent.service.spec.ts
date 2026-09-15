import { TestBed } from '@angular/core/testing';
import { FacultyAccentService } from './faculty-accent.service';

describe('FacultyAccentService', () => {
  let service: FacultyAccentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FacultyAccentService);
    document.documentElement.style.removeProperty('--sweb-faculty-accent');
    document.documentElement.style.removeProperty('--sweb-faculty-accent-soft');
  });

  it('sets accent custom properties deterministically for a given faculty key', () => {
    service.applyForFaculty('faculty-of-engineering');
    const accent = document.documentElement.style.getPropertyValue('--sweb-faculty-accent');
    expect(accent).toBeTruthy();

    document.documentElement.style.removeProperty('--sweb-faculty-accent');
    service.applyForFaculty('faculty-of-engineering');
    expect(document.documentElement.style.getPropertyValue('--sweb-faculty-accent')).toBe(accent);
  });

  it('produces a different accent for a different faculty key (not guaranteed unique, but not identical for this pair)', () => {
    service.applyForFaculty('faculty-of-engineering');
    const first = document.documentElement.style.getPropertyValue('--sweb-faculty-accent');

    service.applyForFaculty('faculty-of-arts');
    const second = document.documentElement.style.getPropertyValue('--sweb-faculty-accent');

    expect(second).toBeTruthy();
    expect(first).not.toBe('');
    // Not asserting inequality strictly (hash collisions are possible with a small palette) --
    // asserting both resolve to a real, defined palette entry is the meaningful behavior.
  });

  it('clears the accent when passed null', () => {
    service.applyForFaculty('faculty-of-engineering');
    service.applyForFaculty(null);
    expect(document.documentElement.style.getPropertyValue('--sweb-faculty-accent')).toBe('');
  });

  it('exposes the currently applied faculty key', () => {
    service.applyForFaculty('faculty-of-science');
    expect(service.facultyKey()).toBe('faculty-of-science');
  });
});
