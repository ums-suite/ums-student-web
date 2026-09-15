import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { StudentDto, StudentRequestDto, SubmitStudentRequestRequest } from './student.types';

/**
 * Interim client for `Student` module endpoints (SWEB-5, extended SWEB-28) -- see this app's
 * README "Known cross-team API-contract gaps". Routes verified directly against `ums-core`'s
 * `UMS.Modules.Student.Api.Endpoints.{StudentProfileEndpoints,StudentRequestEndpoints}`:
 * - `GET /api/v1/student/students/me` (own profile, `RequireLiveSession()`).
 * - `POST /api/v1/student/students/requests/` (SWEB-28).
 * - `GET /api/v1/student/students/requests/{id}` (get-by-id only).
 *
 * **Confirmed gap**: no "list my StudentRequests" endpoint exists at all -- the repository only
 * supports get-by-id and an internal open-request dedup check, never a `GetByStudentAsync`-style
 * list. {@link StudentRequestsStore} (SWEB-28) therefore tracks request ids it creates in
 * `localStorage`, exactly mirroring `RegistrationStore`'s own documented workaround for the same
 * class of gap.
 */
@Injectable({ providedIn: 'root' })
export class StudentApi extends ProvisionalModuleApiBase {
  getMyProfile(): Observable<StudentDto> {
    return this.normalizeErrors(this.http.get<StudentDto>(this.apiUrl('student/students/me')));
  }

  submitStudentRequest(request: SubmitStudentRequestRequest): Observable<StudentRequestDto> {
    return this.normalizeErrors(
      this.http.post<StudentRequestDto>(this.apiUrl('student/students/requests/'), request),
    );
  }

  getStudentRequest(id: string): Observable<StudentRequestDto> {
    return this.normalizeErrors(
      this.http.get<StudentRequestDto>(this.apiUrl(`student/students/requests/${id}`)),
    );
  }
}
