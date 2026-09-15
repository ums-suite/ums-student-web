import {
  addPreference,
  evaluateEligibilitySelfCheck,
  movePreferenceDown,
  movePreferenceUp,
  removePreferenceAt,
  toPreferenceDtos,
} from './hostel.logic';
import type { EligibilityRuleDto } from '../../core/api/hostel.types';
import type { PreferenceDraftEntry } from './hostel.types';

describe('hostel.logic', () => {
  describe('evaluateEligibilitySelfCheck', () => {
    const rules: EligibilityRuleDto[] = [
      { ruleType: 'MinimumYearOfStudy', value: 2, description: 'Must be at least 2nd year' },
      { ruleType: 'FinancialNeedRequired', value: 0, description: 'Must have financial need' },
      {
        ruleType: 'MinimumHomeDistrictDistanceKm',
        value: 50,
        description: 'Home district must be 50km+ away',
      },
    ];

    it('is likelyEligible when every rule passes', () => {
      const result = evaluateEligibilitySelfCheck(rules, {
        yearOfStudy: 3,
        hasFinancialNeed: true,
        homeDistrictDistanceKm: 100,
      });
      expect(result.likelyEligible).toBeTrue();
      expect(result.failedRuleDescriptions).toEqual([]);
    });

    it('reports every failed rule description', () => {
      const result = evaluateEligibilitySelfCheck(rules, {
        yearOfStudy: 1,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: 10,
      });
      expect(result.likelyEligible).toBeFalse();
      expect(result.failedRuleDescriptions.length).toBe(3);
    });

    it('treats a null distance as failing a MinimumHomeDistrictDistanceKm rule', () => {
      const result = evaluateEligibilitySelfCheck([rules[2]], {
        yearOfStudy: 5,
        hasFinancialNeed: true,
        homeDistrictDistanceKm: null,
      });
      expect(result.likelyEligible).toBeFalse();
    });

    it('is vacuously likelyEligible with no rules at all', () => {
      const result = evaluateEligibilitySelfCheck([], {
        yearOfStudy: 1,
        hasFinancialNeed: false,
        homeDistrictDistanceKm: null,
      });
      expect(result.likelyEligible).toBeTrue();
    });
  });

  describe('preference draft list operations', () => {
    const a: PreferenceDraftEntry = {
      hostelId: 'h1',
      hostelName: 'Hostel A',
      preferredRoomType: 'SingleOccupancy',
    };
    const b: PreferenceDraftEntry = {
      hostelId: 'h2',
      hostelName: 'Hostel B',
      preferredRoomType: 'DoubleOccupancy',
    };

    it('addPreference appends a new entry', () => {
      const list = addPreference([a], b);
      expect(list).toEqual([a, b]);
    });

    it('addPreference skips an exact (hostelId, roomType) duplicate', () => {
      const list = addPreference([a], { ...a });
      expect(list).toEqual([a]);
    });

    it('addPreference allows the same hostel with a different room type', () => {
      const list = addPreference([a], { ...a, preferredRoomType: 'DoubleOccupancy' });
      expect(list.length).toBe(2);
    });

    it('removePreferenceAt removes only the targeted index', () => {
      expect(removePreferenceAt([a, b], 0)).toEqual([b]);
      expect(removePreferenceAt([a, b], 1)).toEqual([a]);
    });

    it('movePreferenceUp swaps with the previous entry', () => {
      expect(movePreferenceUp([a, b], 1)).toEqual([b, a]);
    });

    it('movePreferenceUp is a no-op at the top', () => {
      expect(movePreferenceUp([a, b], 0)).toEqual([a, b]);
    });

    it('movePreferenceDown swaps with the next entry', () => {
      expect(movePreferenceDown([a, b], 0)).toEqual([b, a]);
    });

    it('movePreferenceDown is a no-op at the bottom', () => {
      expect(movePreferenceDown([a, b], 1)).toEqual([a, b]);
    });

    it('toPreferenceDtos derives 1-based rank purely from list order', () => {
      expect(toPreferenceDtos([a, b])).toEqual([
        { hostelId: 'h1', preferredRoomType: 'SingleOccupancy', rank: 1 },
        { hostelId: 'h2', preferredRoomType: 'DoubleOccupancy', rank: 2 },
      ]);
    });

    it('toPreferenceDtos re-derives rank correctly after a reorder', () => {
      const reordered = movePreferenceUp([a, b], 1);
      expect(toPreferenceDtos(reordered)).toEqual([
        { hostelId: 'h2', preferredRoomType: 'DoubleOccupancy', rank: 1 },
        { hostelId: 'h1', preferredRoomType: 'SingleOccupancy', rank: 2 },
      ]);
    });
  });
});
