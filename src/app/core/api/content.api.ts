import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { NoticeDto } from './content.types';

/**
 * Interim client for `Content` module endpoints (SWEB-29), verified against
 * `UMS.Modules.Content.Api.Endpoints.NoticeEndpoints`:
 * - `GET /api/v1/content/notices/feed?audience=Student&skip=&take=` -- the authenticated feed
 *   (`ContentPermissions.NoticeRead`), a single-value `audience` string (`AudienceParser.ParseSingle`).
 *   The anonymous `/notices/?audience=public` variant deliberately rejects any authenticated
 *   student calling it with a non-public audience (`notice.audience_requires_auth`), so this app
 *   always uses `/feed`, never the public route.
 * - `GET /notices/{id}` returns `410 Gone` (not 404) once a Notice is `Archived` -- a deliberate
 *   cache-correctness contract, surfaced as a normal `UmsApiError` with `status === 410`.
 *
 * **Confirmed gap**: no "unread notice" concept exists anywhere in Content -- an unread badge for
 * Notices specifically (as opposed to the separate Notifications-module in-app center) is not
 * supported server-side.
 */
@Injectable({ providedIn: 'root' })
export class ContentApi extends ProvisionalModuleApiBase {
  listNoticesFeed(audience: 'Student', skip = 0, take = 20): Observable<NoticeDto[]> {
    const params = new HttpParams()
      .set('audience', audience)
      .set('skip', String(skip))
      .set('take', String(take));
    return this.normalizeErrors(
      this.http.get<NoticeDto[]>(this.apiUrl('content/notices/feed'), { params }),
    );
  }

  getNotice(id: string): Observable<NoticeDto> {
    return this.normalizeErrors(this.http.get<NoticeDto>(this.apiUrl(`content/notices/${id}`)));
  }
}
