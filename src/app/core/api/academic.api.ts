import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  AcademicSessionDto,
  CourseDto,
  CourseOfferingDto,
  CreateEnrollmentRequest,
  DropEnrollmentRequest,
  EnrollmentDto,
  ProgramDto,
  TranscriptDto,
} from './academic.types';

/**
 * Interim client for `Academic` module endpoints (SWEB-5) -- see this app's README "Known
 * cross-team API-contract gaps" and each method's own doc comment for the exact route verified
 * against `ums-core`'s `UMS.Modules.Academic.Api.Endpoints.*`.
 */
@Injectable({ providedIn: 'root' })
export class AcademicApi extends ProvisionalModuleApiBase {
  /** `GET /api/v1/academic/course-offerings?semester={id}`. No other filter query params exist server-side (confirmed) -- see `academic.types.ts` `CourseOfferingDto` doc. */
  listCourseOfferings(semesterId: string): Observable<CourseOfferingDto[]> {
    const params = new HttpParams().set('semester', semesterId);
    return this.normalizeErrors(
      this.http.get<CourseOfferingDto[]>(this.apiUrl('academic/course-offerings'), { params }),
    );
  }

  /** `GET /api/v1/academic/course-offerings/{id}` -- used for the seat-gauge reconcile-on-rejection re-fetch (design-decisions.md "Seat-Gauge Trust Boundary"). */
  getCourseOffering(id: string): Observable<CourseOfferingDto> {
    return this.normalizeErrors(
      this.http.get<CourseOfferingDto>(this.apiUrl(`academic/course-offerings/${id}`)),
    );
  }

  /** `GET /api/v1/academic/courses/{id}`. */
  getCourse(id: string): Observable<CourseDto> {
    return this.normalizeErrors(this.http.get<CourseDto>(this.apiUrl(`academic/courses/${id}`)));
  }

  /** `GET /api/v1/academic/programs/{id}`. */
  getProgram(id: string): Observable<ProgramDto> {
    return this.normalizeErrors(this.http.get<ProgramDto>(this.apiUrl(`academic/programs/${id}`)));
  }

  /** `GET /api/v1/academic/academic-sessions/{id}`. */
  getAcademicSession(id: string): Observable<AcademicSessionDto> {
    return this.normalizeErrors(
      this.http.get<AcademicSessionDto>(this.apiUrl(`academic/academic-sessions/${id}`)),
    );
  }

  /**
   * `POST /api/v1/academic/enrollments`. Every validation failure (prerequisite/credit-limit/
   * timetable-conflict/seat-limit/window-closed/status) surfaces as a `UmsApiError.code`, e.g.
   * `"enrollment.prerequisite_not_met"` -- {@link RegistrationStore} branches on these exact
   * codes (SWEB-12/SWEB-13), never re-deriving the reason client-side.
   */
  createEnrollment(request: CreateEnrollmentRequest): Observable<EnrollmentDto> {
    return this.normalizeErrors(
      this.http.post<EnrollmentDto>(this.apiUrl('academic/enrollments'), request),
    );
  }

  /** `DELETE /api/v1/academic/enrollments/{id}` -- a drop is a status transition to `Dropped`, never a deletion (Invariant §8.5); the enrollment row itself is retained server-side. */
  dropEnrollment(id: string, request: DropEnrollmentRequest): Observable<EnrollmentDto> {
    return this.normalizeErrors(
      this.http.request<EnrollmentDto>('DELETE', this.apiUrl(`academic/enrollments/${id}`), {
        body: request,
      }),
    );
  }

  /**
   * `GET /api/v1/academic/enrollments/{id}`. **Confirmed gap: no "list my enrollments" endpoint
   * exists** -- only get-by-id. {@link RegistrationStore} tracks enrollment ids it creates/knows
   * about in `localStorage` (same-browser-only, mirroring `ums-admission-web`'s
   * `WizardDraftStore` pattern) and re-fetches each by id through this method; an enrollment made
   * from a different device/browser is invisible to this app until a real list endpoint ships.
   */
  getEnrollment(id: string): Observable<EnrollmentDto> {
    return this.normalizeErrors(
      this.http.get<EnrollmentDto>(this.apiUrl(`academic/enrollments/${id}`)),
    );
  }

  /** `GET /api/v1/academic/students/{id}/results` -- Published-only by construction server-side (Invariant §8.1). */
  getMyPublishedResults(studentId: string) {
    return this.normalizeErrors(
      this.http.get<TranscriptDto['results']>(
        this.apiUrl(`academic/students/${studentId}/results`),
      ),
    );
  }

  /** `GET /api/v1/academic/students/{id}/transcript`. */
  getMyTranscript(studentId: string): Observable<TranscriptDto> {
    return this.normalizeErrors(
      this.http.get<TranscriptDto>(this.apiUrl(`academic/students/${studentId}/transcript`)),
    );
  }
}
