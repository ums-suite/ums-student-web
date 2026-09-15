/**
 * `Hostel` module DTOs (SWEB-5, extended SWEB-23/24/25), verified against
 * `UMS.Modules.Hostel.Application/*` and `UMS.Modules.Hostel.Api/Endpoints/*.cs`.
 */
export type AllocationStatus = 'Pending' | 'FeePaid' | 'Active' | 'CheckedOut' | 'Expired';

/** Statuses Invariant §8.6 treats as "currently occupying an active slot" -- exactly the DB's own partial-unique-index filter (`ux_allocations_student_nonterminal`, confirmed via `AllocationConfiguration.cs`), not a client-invented guess. */
export const NON_TERMINAL_ALLOCATION_STATUSES: ReadonlySet<AllocationStatus> = new Set([
  'Pending',
  'FeePaid',
  'Active',
]);

export interface AllocationDto {
  readonly id: string;
  readonly studentId: string;
  readonly bedId: string;
  readonly roomId: string;
  readonly hostelId: string;
  readonly hostelApplicationId: string;
  readonly status: AllocationStatus;
  readonly invoiceId: string | null;
  readonly feeGraceDeadline: string;
  readonly checkOutKind: string | null;
  readonly refundRequested: boolean;
  readonly createdAt: string;
  readonly feePaidAt: string | null;
  readonly activatedAt: string | null;
  readonly checkedOutAt: string | null;
  readonly expiredAt: string | null;
}

export type CheckOutType = 'Voluntary' | 'EndOfSession' | 'Disciplinary';

export interface CheckOutRequest {
  readonly checkOutType: CheckOutType;
}

export type HostelType = 'Male' | 'Female' | 'International' | 'Mixed';
export type RoomType = 'SingleOccupancy' | 'DoubleOccupancy' | 'TripleOccupancy' | 'Dormitory';

export interface HostelDto {
  readonly id: string;
  readonly name: string;
  readonly type: HostelType;
  readonly createdAt: string;
}

export interface BuildingDto {
  readonly id: string;
  readonly hostelId: string;
  readonly name: string;
  readonly createdAt: string;
}

/**
 * `GET /api/v1/hostel/buildings/{buildingId}/rooms`. **Confirmed gap**: no occupied/available
 * flag or occupied-count anywhere on this DTO or {@link BedDto} -- per `Bed.cs`'s own domain
 * comment, "availability is derived entirely from `hostel.allocations`", and no endpoint exposes
 * that derivation. The visual room/bed picker (SWEB-23) can render room/bed *identity*
 * (building/room number/type/capacity, bed label) but cannot show real occupancy -- flagged, not
 * silently faked with an invented "available" count.
 */
export interface RoomDto {
  readonly id: string;
  readonly buildingId: string;
  readonly hostelId: string;
  readonly roomNumber: string;
  readonly type: RoomType;
  readonly capacity: number;
  readonly createdAt: string;
}

export interface BedDto {
  readonly id: string;
  readonly roomId: string;
  readonly label: string;
  readonly createdAt: string;
}

export type HostelEligibilityRuleType =
  'MinimumYearOfStudy' | 'FinancialNeedRequired' | 'MinimumHomeDistrictDistanceKm';

export interface EligibilityRuleDto {
  readonly ruleType: HostelEligibilityRuleType;
  readonly value: number;
  readonly description: string;
}

/**
 * `GET /api/v1/hostel/application-windows`. **Confirmed gap**: no server-side "am I eligible"
 * pre-check endpoint exists -- {@link EligibilityRuleDto} is the raw rule set a student
 * self-evaluates against client-side (display-only, SWEB-23's eligibility view); the real,
 * authoritative eligibility outcome (`HostelApplicationDto.isEligible`/`eligibilityScore`) is only
 * computed after submission, during the officer-triggered ranking pass.
 */
export interface ApplicationWindowDto {
  readonly id: string;
  readonly sessionLabel: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly eligibleProgramIds: readonly string[];
  readonly eligibleYears: readonly number[];
  readonly eligibilityRules: readonly EligibilityRuleDto[];
  readonly rulesVersion: number;
  readonly createdAt: string;
}

/** A ranked `(HostelId, RoomType)` preference -- **no room/bed-specific id is ever submitted by the student**; a specific bed is chosen automatically server-side at approval time. */
export interface HostelPreferenceDto {
  readonly hostelId: string;
  readonly preferredRoomType: RoomType;
  readonly rank: number;
}

export interface CreateHostelApplicationRequest {
  readonly applicationWindowId: string;
  readonly yearOfStudy: number;
  readonly hasFinancialNeed: boolean;
  readonly homeDistrictDistanceKm: number | null;
  readonly preferences: readonly HostelPreferenceDto[];
}

export type HostelApplicationStatus =
  'Draft' | 'Submitted' | 'Ranked' | 'Approved' | 'Waitlisted' | 'Rejected' | 'Withdrawn';

export interface HostelApplicationDto {
  readonly id: string;
  readonly studentId: string;
  readonly applicationWindowId: string;
  readonly status: HostelApplicationStatus;
  readonly preferences: readonly HostelPreferenceDto[];
  readonly yearOfStudy: number;
  readonly hasFinancialNeed: boolean;
  readonly homeDistrictDistanceKm: number | null;
  readonly eligibilityScore: number | null;
  readonly isEligible: boolean | null;
  readonly rankPosition: number | null;
  readonly decisionReason: string | null;
  readonly allocationId: string | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
}

export type ComplaintCategory = 'Maintenance' | 'RoommateDispute' | 'Damage' | 'Other';
export type ComplaintStatus = 'Open' | 'InProgress' | 'Resolved' | 'Rejected';

/** `POST /api/v1/hostel/complaints` -- **the idempotency key here is a body field** (`IdempotencyKey`), unlike Finance's Payment initiation which uses an `Idempotency-Key` header. The two modules are confirmed NOT consistent with each other; never assume one convention from the other. */
export interface SubmitComplaintRequest {
  readonly allocationId: string;
  readonly category: ComplaintCategory;
  readonly description: string;
  readonly idempotencyKey: string | null;
}

export interface ComplaintDto {
  readonly id: string;
  readonly studentId: string;
  readonly allocationId: string;
  readonly category: ComplaintCategory;
  readonly description: string;
  readonly status: ComplaintStatus;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}
