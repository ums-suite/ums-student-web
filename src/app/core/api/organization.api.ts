import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  OrganizationBuildingDto,
  OrganizationPage,
  OrganizationRoomDto,
} from './organization.types';

/**
 * Interim client for `Organization` module Room/Building endpoints (SWEB-16), verified against
 * `UMS.Modules.Organization.Api.Endpoints.FacilityEndpoints` -- all anonymous (`AllowAnonymous`),
 * matching `ums-public-web`/`ums-admin-web`'s own read of the same building data
 * (requirement-spec.md §3.3: "reusing the same building data... never a re-typed duplicate").
 */
@Injectable({ providedIn: 'root' })
export class OrganizationApi extends ProvisionalModuleApiBase {
  /** Returns a paged envelope (`{ items, totalCount, skip, take }`), never a raw array -- confirmed against `BuildingListPage`. */
  listBuildings(campusId?: string): Observable<OrganizationPage<OrganizationBuildingDto>> {
    let params = new HttpParams();
    if (campusId) {
      params = params.set('campusId', campusId);
    }
    return this.normalizeErrors(
      this.http.get<OrganizationPage<OrganizationBuildingDto>>(
        this.apiUrl('organization/buildings/'),
        { params },
      ),
    );
  }

  getBuilding(id: string): Observable<OrganizationBuildingDto> {
    return this.normalizeErrors(
      this.http.get<OrganizationBuildingDto>(this.apiUrl(`organization/buildings/${id}`)),
    );
  }

  /** Returns a paged envelope (`{ items, totalCount, skip, take }`), never a raw array -- confirmed against `RoomListPage`. */
  listRoomsForBuilding(buildingId: string): Observable<OrganizationPage<OrganizationRoomDto>> {
    return this.normalizeErrors(
      this.http.get<OrganizationPage<OrganizationRoomDto>>(
        this.apiUrl(`organization/buildings/${buildingId}/rooms`),
      ),
    );
  }

  getRoom(id: string): Observable<OrganizationRoomDto> {
    return this.normalizeErrors(
      this.http.get<OrganizationRoomDto>(this.apiUrl(`organization/rooms/${id}`)),
    );
  }
}
