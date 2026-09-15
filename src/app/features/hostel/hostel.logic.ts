import type { EligibilityRuleDto, HostelPreferenceDto } from '../../core/api/hostel.types';
import type {
  EligibilitySelfCheckInput,
  EligibilitySelfCheckResult,
  PreferenceDraftEntry,
} from './hostel.types';

/**
 * Pure Hostel logic (SWEB-23/24, test-coverage NFR). Deliberately free of HttpClient/DI/signals.
 */

/**
 * A purely client-side, non-binding self-assessment (see `hostel.types.ts`
 * `EligibilitySelfCheckResult` doc for why this is never authoritative).
 */
export function evaluateEligibilitySelfCheck(
  rules: readonly EligibilityRuleDto[],
  input: EligibilitySelfCheckInput,
): EligibilitySelfCheckResult {
  const failed = rules.filter((rule) => !isRuleSatisfied(rule, input));
  return {
    likelyEligible: failed.length === 0,
    failedRuleDescriptions: failed.map((rule) => rule.description),
  };
}

function isRuleSatisfied(rule: EligibilityRuleDto, input: EligibilitySelfCheckInput): boolean {
  switch (rule.ruleType) {
    case 'MinimumYearOfStudy':
      return input.yearOfStudy >= rule.value;
    case 'FinancialNeedRequired':
      return input.hasFinancialNeed;
    case 'MinimumHomeDistrictDistanceKm':
      return input.homeDistrictDistanceKm !== null && input.homeDistrictDistanceKm >= rule.value;
    default:
      return true;
  }
}

/** Appends a new preference, skipping an exact `(hostelId, preferredRoomType)` duplicate. */
export function addPreference(
  list: readonly PreferenceDraftEntry[],
  entry: PreferenceDraftEntry,
): readonly PreferenceDraftEntry[] {
  const exists = list.some(
    (p) => p.hostelId === entry.hostelId && p.preferredRoomType === entry.preferredRoomType,
  );
  return exists ? list : [...list, entry];
}

export function removePreferenceAt(
  list: readonly PreferenceDraftEntry[],
  index: number,
): readonly PreferenceDraftEntry[] {
  return list.filter((_, i) => i !== index);
}

/** Moves the entry at `index` one position earlier (higher rank -- rank 1 is most preferred) -- a no-op at the top. */
export function movePreferenceUp(
  list: readonly PreferenceDraftEntry[],
  index: number,
): readonly PreferenceDraftEntry[] {
  if (index <= 0 || index >= list.length) {
    return list;
  }
  const copy = [...list];
  [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
  return copy;
}

/** Moves the entry at `index` one position later -- a no-op at the bottom. */
export function movePreferenceDown(
  list: readonly PreferenceDraftEntry[],
  index: number,
): readonly PreferenceDraftEntry[] {
  if (index < 0 || index >= list.length - 1) {
    return list;
  }
  const copy = [...list];
  [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
  return copy;
}

/** Ranks are always 1-based and derived purely from list order at submit time -- never stored independently, so reordering can never leave a stale/duplicate rank behind. */
export function toPreferenceDtos(
  list: readonly PreferenceDraftEntry[],
): readonly HostelPreferenceDto[] {
  return list.map((entry, index) => ({
    hostelId: entry.hostelId,
    preferredRoomType: entry.preferredRoomType,
    rank: index + 1,
  }));
}
