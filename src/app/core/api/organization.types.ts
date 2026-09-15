/**
 * `Organization` module DTOs (SWEB-16, Room/Building only -- the slice this app consumes per
 * requirement-spec.md §6 "Organization (Faculty/Department/Room display data)"), verified against
 * `UMS.Modules.Organization.Application/*` and
 * `UMS.Modules.Organization.Api/Endpoints/FacilityEndpoints.cs`.
 *
 * **Confirmed gap**: `Room` has no floor field at all -- only `name` (free-text, e.g. `"3F-301"`
 * if the underlying data encodes a floor that way), `capacity`, and `roomType` (a free-text
 * descriptive string, not an enum). `RoomDto` also has no embedded building name and `BuildingDto`
 * has no embedded campus name -- resolving "building X, room Y" for the "where is this room"
 * affordance (SWEB-16) always takes two calls (`getRoom` then `getBuilding`), never one.
 *
 * Distinct from, and unrelated to, Hostel's own same-named `RoomDto`/`BuildingDto`
 * (`hostel.types.ts`) -- two different modules, two different schemas, never interchange them.
 */
export interface OrganizationRoomDto {
  readonly id: string;
  readonly buildingId: string;
  readonly name: string;
  readonly capacity: number | null;
  readonly roomType: string | null;
  readonly createdAt: string;
}

export interface OrganizationBuildingDto {
  readonly id: string;
  readonly campusId: string;
  readonly name: string;
  readonly code: string | null;
  readonly createdAt: string;
}

/** `GET /buildings/` and `GET /buildings/{id}/rooms` both return a paged envelope, never a raw array -- confirmed against `BuildingListPage`/`RoomListPage`. */
export interface OrganizationPage<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly skip: number;
  readonly take: number;
}
