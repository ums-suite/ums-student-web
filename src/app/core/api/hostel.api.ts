import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { UmsApiError } from '@ums/shared';
import type { AllocationDto } from './hostel.types';

/**
 * Interim client for `Hostel` module endpoints (SWEB-5), read-only surface only for this pass
 * (SWEB-23 through SWEB-25 build the full hostel feature). Verified against
 * `UMS.Modules.Hostel.Api.Endpoints.AllocationEndpoints`:
 * - `GET /api/v1/hostel/allocations/me` -- resolves the caller's own current allocation.
 */
@Injectable({ providedIn: 'root' })
export class HostelApi extends ProvisionalModuleApiBase {
  /** `null` when the student has no active allocation (a 404 is the expected, non-error shape here). */
  getMyAllocation(): Observable<AllocationDto | null> {
    return this.normalizeErrors(
      this.http.get<AllocationDto>(this.apiUrl('hostel/allocations/me')),
    ).pipe(
      catchError((error: UmsApiError) => {
        if (error.status === 404) {
          return of(null);
        }
        throw error;
      }),
    );
  }
}
