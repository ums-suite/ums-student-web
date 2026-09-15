import type { RoomType } from '../../core/api/hostel.types';

/**
 * A ranked `(Hostel, RoomType)` preference in progress, before submit (SWEB-23). Carries
 * `hostelName` purely for display -- the actual `POST /applications` request only ever sends
 * `hostelId`/`preferredRoomType`/`rank` (see `hostel.types.ts` `HostelPreferenceDto` in
 * `core/api`, confirmed: no room/bed id is ever submitted by the student).
 */
export interface PreferenceDraftEntry {
  readonly hostelId: string;
  readonly hostelName: string;
  readonly preferredRoomType: RoomType;
}

/** Student-entered inputs for the eligibility self-check (SWEB-23) -- never sent anywhere on their own; only folded into `CreateHostelApplicationRequest` at actual submit time. */
export interface EligibilitySelfCheckInput {
  readonly yearOfStudy: number;
  readonly hasFinancialNeed: boolean;
  readonly homeDistrictDistanceKm: number | null;
}

/**
 * A purely client-side, **non-binding** self-assessment against an `ApplicationWindow`'s raw
 * `EligibilityRuleDto[]` (SWEB-23). **Confirmed gap**: no server-side "am I eligible" pre-check
 * endpoint exists -- `HostelApplicationDto.isEligible`/`eligibilityScore` are populated only after
 * submission, during the officer-triggered ranking pass. This result is shown as a preview to help
 * a student decide whether to apply, never as a guarantee of the eventual outcome.
 */
export interface EligibilitySelfCheckResult {
  readonly likelyEligible: boolean;
  readonly failedRuleDescriptions: readonly string[];
}
