import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import type { UmsApiError } from '@ums/shared';
import { ProvisionalModuleApiBase } from '../../core/http/provisional-module-api.base';
import type { WaitlistPositionResponse } from './registration.types';

/**
 * Interim client for course-registration waitlisting (SWEB-15) -- **built against a documented,
 * assumed contract, not a verified one**. `ums-core`'s Academic module has no waitlist concept
 * for course enrollment today (confirmed by direct source inspection -- see
 * `registration.types.ts` `WaitlistPositionResponse` doc for the full explanation). Every method
 * below assumes:
 *
 * - `POST {baseUrl}/api/v1/academic/course-offerings/{id}/waitlist` joins the waitlist, returning
 *   `{ position: number }`.
 * - `GET {baseUrl}/api/v1/academic/course-offerings/{id}/waitlist/me` returns the caller's current
 *   {@link WaitlistPositionResponse} (used for both queue-position display and detecting a seat
 *   offer, folded into one poll per this app's short-poll infrastructure, SWEB-8).
 * - `POST {baseUrl}/api/v1/academic/course-offerings/{id}/waitlist/confirm` confirms a seat offer.
 *
 * Every call here will 404 against the real backend until Academic ships this -- flagged in this
 * app's PR as a cross-team follow-up, exactly like `ums-admission-web` flagged its own confirmed
 * gaps (e.g. `ApplicantApi.updateProfile`). {@link joinWaitlist} and {@link getMyWaitlistStatus}
 * degrade to a "not available" (`null`) signal on a 404 rather than throwing, so a missing backend
 * feature never crashes the Registration screen around it.
 */
@Injectable({ providedIn: 'root' })
export class WaitlistApi extends ProvisionalModuleApiBase {
  joinWaitlist(offeringId: string): Observable<WaitlistPositionResponse | null> {
    return this.normalizeErrors(
      this.http.post<WaitlistPositionResponse>(
        this.apiUrl(`academic/course-offerings/${offeringId}/waitlist`),
        {},
      ),
    ).pipe(catchError((error: UmsApiError) => resolveNullOn404(error)));
  }

  getMyWaitlistStatus(offeringId: string): Observable<WaitlistPositionResponse | null> {
    return this.normalizeErrors(
      this.http.get<WaitlistPositionResponse>(
        this.apiUrl(`academic/course-offerings/${offeringId}/waitlist/me`),
      ),
    ).pipe(catchError((error: UmsApiError) => resolveNullOn404(error)));
  }

  confirmWaitlistOffer(offeringId: string): Observable<void> {
    return this.normalizeErrors(
      this.http
        .post<unknown>(this.apiUrl(`academic/course-offerings/${offeringId}/waitlist/confirm`), {})
        .pipe(map(() => undefined)),
    );
  }
}

function resolveNullOn404(error: UmsApiError): Observable<null> {
  if (error.status === 404) {
    return of(null);
  }
  return throwError(() => error);
}
