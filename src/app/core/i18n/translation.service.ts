import { Injectable, computed, inject, isDevMode } from '@angular/core';
import { LocaleService } from '@ums/shared';
import { BN_TRANSLATIONS } from './dictionaries/bn';
import { EN_TRANSLATIONS } from './dictionaries/en';
import type { TranslationDictionary, TranslationParams } from './translation-dictionary.types';

const DICTIONARIES: Readonly<Record<'en' | 'bn', TranslationDictionary>> = {
  en: EN_TRANSLATIONS,
  bn: BN_TRANSLATIONS,
};

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Runtime UI-string translation (SWEB-3, requirement-spec.md §2 i18n row / §4 Localization NFR).
 *
 * Deliberately a small hand-rolled dictionary lookup, not `@angular/localize`: Angular's built-in
 * i18n bakes one locale per build/bundle, which fits this app's own CSR-authenticated-portal
 * model poorly -- switching language would mean a full navigation to a different locale bundle
 * mid-session. This service instead mirrors `@ums/design-system`'s `ThemeService` pattern (a
 * signal the app can flip at runtime with no reload) and stays reactive to `@ums/shared`'s
 * `LocaleService` signal via a `computed()`, so every template reading `t()` re-renders the
 * instant the active locale changes -- the per-user persisted preference itself
 * (requirement-spec.md §2 i18n row: "per-user persisted preference") is `LocaleService`'s own
 * job (it persists to `localStorage`).
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly localeService = inject(LocaleService);

  /** The active dictionary, reactive to `LocaleService.locale`. */
  private readonly dictionary = computed<TranslationDictionary>(
    () => DICTIONARIES[this.localeService.locale()],
  );

  /**
   * Looks up `key` in the active locale's dictionary, falling back to English (matching the
   * server-side translation-table fallback convention, edge-cases.md "Missing Bengali translation
   * for a Notice/content item"), then to the raw key itself (so a missing translation fails loud
   * in the rendered UI rather than silently as an empty string).
   */
  t(key: string, params?: TranslationParams): string {
    const template = this.dictionary()[key] ?? EN_TRANSLATIONS[key];

    if (template === undefined) {
      if (isDevMode()) {
        console.warn(`[i18n] Missing translation key: "${key}"`);
      }
      return key;
    }

    return params ? interpolate(template, params) : template;
  }
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, paramName: string) =>
    Object.prototype.hasOwnProperty.call(params, paramName) ? String(params[paramName]) : match,
  );
}
