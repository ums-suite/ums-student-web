import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { StudentDto } from './student.types';

/**
 * Interim client for `Student` module endpoints (SWEB-5) -- see this app's README "Known
 * cross-team API-contract gaps". Routes verified directly against `ums-core`'s
 * `UMS.Modules.Student.Api.Endpoints.StudentEndpoints`:
 * - `GET /api/v1/student/students/me` (own profile, `RequireLiveSession()`).
 */
@Injectable({ providedIn: 'root' })
export class StudentApi extends ProvisionalModuleApiBase {
  getMyProfile(): Observable<StudentDto> {
    return this.normalizeErrors(this.http.get<StudentDto>(this.apiUrl('student/students/me')));
  }
}
