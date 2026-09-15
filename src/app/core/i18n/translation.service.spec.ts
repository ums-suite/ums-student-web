import { TestBed } from '@angular/core/testing';
import { LocaleService } from '@ums/shared';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;
  let localeService: LocaleService;

  beforeEach(() => {
    // LocaleService persists the active locale to real browser localStorage, which -- unlike
    // TestBed's DI container -- is NOT reset between specs in the same Karma run; clear it first
    // so every spec starts from the documented English default regardless of run order.
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
    localeService = TestBed.inject(LocaleService);
  });

  afterEach(() => localStorage.clear());

  it('resolves an English key by default', () => {
    expect(service.t('shell.appName')).toBe('ums-student-web');
  });

  it('resolves the Bengali translation once the locale switches', () => {
    localeService.setLocale('bn');
    expect(service.t('shell.appName')).not.toBe('ums-student-web');
  });

  it('re-resolves live when the locale signal changes again', () => {
    localeService.setLocale('bn');
    expect(service.t('shell.appName')).not.toBe('ums-student-web');

    localeService.setLocale('en');
    expect(service.t('shell.appName')).toBe('ums-student-web');
  });

  it('falls back to the raw key when missing from every dictionary, without throwing', () => {
    expect(service.t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates {{placeholder}} params from the resolved template', () => {
    expect(service.t('dashboard.greeting', { name: 'Ayesha' })).toContain('Ayesha');
  });

  it('leaves an unmatched placeholder untouched when no param is supplied for it', () => {
    expect(service.t('dashboard.greeting')).toContain('{{name}}');
  });
});
