import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  AllocationDto,
  ApplicationWindowDto,
  BedDto,
  BuildingDto,
  CheckOutRequest,
  ComplaintDto,
  CreateHostelApplicationRequest,
  HostelApplicationDto,
  HostelDto,
  RoomDto,
  SubmitComplaintRequest,
} from './hostel.types';

/**
 * Interim client for `Hostel` module endpoints (SWEB-5, extended SWEB-23/24/25). Verified against
 * `UMS.Modules.Hostel.Api.Endpoints.*`:
 * - `GET /api/v1/hostel/allocations/me` -- **a list**, not a single object (confirmed directly
 *   against `AllocationEndpoints.cs`/`AllocationService.GetByStudentAsync`, which returns
 *   `IReadOnlyList<AllocationDto>` -- 200 with `[]` when the student has none, never a 404).
 *   {@link getMyAllocations} reflects this correctly; a prior version of this client
 *   (`getMyAllocation`, singular, treating a 404 as "no allocation") was built against a wrong
 *   assumption and has been corrected here -- flagged in this PR since `DashboardStore` (SWEB-9,
 *   already merged) consumed the old, incorrect method.
 * - `GET /api/v1/hostel/applications/me` -- also a list, same pattern.
 * - Neither a single `HostelApplication` nor a single `Allocation` has a `GET /{id}` route exposed
 *   to a student (confirmed gap) -- only the two `/me` list endpoints above.
 */
@Injectable({ providedIn: 'root' })
export class HostelApi extends ProvisionalModuleApiBase {
  listHostels(): Observable<HostelDto[]> {
    return this.normalizeErrors(this.http.get<HostelDto[]>(this.apiUrl('hostel/hostels')));
  }

  listBuildings(hostelId: string): Observable<BuildingDto[]> {
    return this.normalizeErrors(
      this.http.get<BuildingDto[]>(this.apiUrl(`hostel/hostels/${hostelId}/buildings`)),
    );
  }

  listRooms(buildingId: string): Observable<RoomDto[]> {
    return this.normalizeErrors(
      this.http.get<RoomDto[]>(this.apiUrl(`hostel/buildings/${buildingId}/rooms`)),
    );
  }

  listBeds(roomId: string): Observable<BedDto[]> {
    return this.normalizeErrors(
      this.http.get<BedDto[]>(this.apiUrl(`hostel/rooms/${roomId}/beds`)),
    );
  }

  listApplicationWindows(): Observable<ApplicationWindowDto[]> {
    return this.normalizeErrors(
      this.http.get<ApplicationWindowDto[]>(this.apiUrl('hostel/application-windows')),
    );
  }

  getApplicationWindow(id: string): Observable<ApplicationWindowDto> {
    return this.normalizeErrors(
      this.http.get<ApplicationWindowDto>(this.apiUrl(`hostel/application-windows/${id}`)),
    );
  }

  submitApplication(request: CreateHostelApplicationRequest): Observable<HostelApplicationDto> {
    return this.normalizeErrors(
      this.http.post<HostelApplicationDto>(this.apiUrl('hostel/applications'), request),
    );
  }

  getMyApplications(): Observable<HostelApplicationDto[]> {
    return this.normalizeErrors(
      this.http.get<HostelApplicationDto[]>(this.apiUrl('hostel/applications/me')),
    );
  }

  withdrawApplication(id: string): Observable<HostelApplicationDto> {
    return this.normalizeErrors(
      this.http.post<HostelApplicationDto>(this.apiUrl(`hostel/applications/${id}/withdraw`), {}),
    );
  }

  /** See class doc -- a list, `[]` when the student has no allocation history (never a 404). */
  getMyAllocations(): Observable<AllocationDto[]> {
    return this.normalizeErrors(
      this.http.get<AllocationDto[]>(this.apiUrl('hostel/allocations/me')),
    );
  }

  /** SWEB-24: self-checkout is always forced to `Voluntary` server-side regardless of what's sent, when the caller owns the `Allocation` (confirmed in `AllocationEndpoints.cs`). */
  checkOut(id: string, request: CheckOutRequest): Observable<AllocationDto> {
    return this.normalizeErrors(
      this.http.post<AllocationDto>(this.apiUrl(`hostel/allocations/${id}/check-out`), request),
    );
  }

  submitComplaint(request: SubmitComplaintRequest): Observable<ComplaintDto> {
    return this.normalizeErrors(
      this.http.post<ComplaintDto>(this.apiUrl('hostel/complaints'), request),
    );
  }

  getMyComplaints(): Observable<ComplaintDto[]> {
    return this.normalizeErrors(this.http.get<ComplaintDto[]>(this.apiUrl('hostel/complaints/me')));
  }
}
