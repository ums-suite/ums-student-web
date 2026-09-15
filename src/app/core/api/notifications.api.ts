import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { NotificationDeliveryAttemptDto, UnreadCountDto } from './notifications.types';

/**
 * Interim client for `Notifications` module endpoints (SWEB-29/30), verified against
 * `UMS.Modules.Notifications.Api.Endpoints.NotificationCenterEndpoints`:
 * - `GET /api/v1/notifications/me/?skip=&take=` -- the in-app notification center list.
 * - `GET /me/unread-count`, `PATCH /me/{id}/read`, `PATCH /me/read-all`.
 *
 * **Confirmed gaps** (see `notifications.types.ts` doc): no real-time push transport (SSE/
 * WebSocket/SignalR) exists anywhere server-side, no notification-preference read/write endpoint
 * exists, and no push-subscription-registration endpoint exists despite `Push` being a modeled
 * channel enum member. None of those three are built against here -- they are genuinely absent,
 * not merely unconfirmed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApi extends ProvisionalModuleApiBase {
  listMyNotifications(skip = 0, take = 20): Observable<NotificationDeliveryAttemptDto[]> {
    const params = new HttpParams().set('skip', String(skip)).set('take', String(take));
    return this.normalizeErrors(
      this.http.get<NotificationDeliveryAttemptDto[]>(this.apiUrl('notifications/me/'), {
        params,
      }),
    );
  }

  getUnreadCount(): Observable<number> {
    return this.normalizeErrors(
      this.http.get<UnreadCountDto>(this.apiUrl('notifications/me/unread-count')),
    ).pipe(map((dto) => dto.unreadCount));
  }

  markRead(id: string): Observable<void> {
    return this.normalizeErrors(
      this.http
        .patch<unknown>(this.apiUrl(`notifications/me/${id}/read`), {})
        .pipe(map(() => undefined)),
    );
  }

  markAllRead(): Observable<void> {
    return this.normalizeErrors(
      this.http
        .patch<unknown>(this.apiUrl('notifications/me/read-all'), {})
        .pipe(map(() => undefined)),
    );
  }
}
