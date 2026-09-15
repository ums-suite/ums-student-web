import { TestBed } from '@angular/core/testing';
import { LocaleService } from '@ums/shared';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let localeService: LocaleService;

  beforeEach(() => {
    // See translation.service.spec.ts -- LocaleService persists to real localStorage across specs.
    localStorage.clear();
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
    localeService = TestBed.inject(LocaleService);
  });

  afterEach(() => localStorage.clear());

  it('transforms a key to its English translation by default', () => {
    expect(pipe.transform('shell.appName')).toBe('ums-student-web');
  });

  it('reflects a live locale change (impure pipe, no page reload)', () => {
    localeService.setLocale('bn');
    expect(pipe.transform('shell.appName')).not.toBe('ums-student-web');
  });

  it('passes interpolation params through', () => {
    expect(pipe.transform('dashboard.greeting', { name: 'Karim' })).toContain('Karim');
  });
});
