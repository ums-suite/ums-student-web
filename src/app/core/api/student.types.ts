/**
 * `Student` module DTOs (SWEB-5), verified directly against `ums-core`'s own
 * `UMS.Modules.Student.Application/Students/StudentDto.cs` and
 * `UMS.Modules.Student.Api/Endpoints/StudentEndpoints.cs` -- not guessed.
 *
 * **Confirmed gap**: `StudentDto` carries only `programId`/`departmentId` (GUIDs), never a
 * current-semester/session or a resolved program/department *name* -- the Dashboard resolves
 * those separately via {@link AcademicApi}. There is also no "current semester" concept tied to
 * `Student` at all server-side; it is inferred client-side from the student's own tracked
 * enrollments (see `RegistrationStore`'s own doc comment on the "no list my enrollments" gap).
 */
export type StudentStatus = 'Enrolled' | 'Active' | 'Graduated' | 'Suspended' | 'Transferred';

export interface StudentDto {
  readonly id: string;
  readonly studentNumber: string;
  readonly departmentId: string;
  readonly programId: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly givenNameBn: string | null;
  readonly familyNameBn: string | null;
  readonly email: string;
  readonly mobile: string | null;
  readonly dateOfBirth: string;
  readonly nationalId: string | null;
  readonly status: StudentStatus;
  readonly identityUserId: string | null;
  readonly idCardDocumentId: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly photoUrl: string | null;
  readonly createdAt: string;
  /** Optimistic-concurrency token -- must be sent back unchanged on a self-service profile update. */
  readonly version: number;
}

/**
 * `StudentRequest` (SWEB-28), verified against
 * `UMS.Modules.Student.Application/StudentRequests/*` and
 * `UMS.Modules.Student.Api/Endpoints/StudentRequestEndpoints.cs`.
 *
 * `POST /api/v1/student/students/requests/` is a single discriminated-body endpoint: exactly one
 * of `reason`/`purpose`/`description` is meaningful, selected by `requestType`
 * (`IdReissue` -> `reason`, `TranscriptRequest` -> `purpose`, `Grievance` -> `description` +
 * `isAgainstOwnDepartmentHead`) -- never send more than the one field the type calls for.
 */
export type StudentRequestType = 'IdReissue' | 'TranscriptRequest' | 'Grievance';

export type StudentRequestStatus =
  'Submitted' | 'UnderReview' | 'Approved' | 'Rejected' | 'Fulfilled';

export interface SubmitStudentRequestRequest {
  readonly requestType: StudentRequestType;
  readonly reason: string | null;
  readonly purpose: string | null;
  readonly description: string | null;
  readonly isAgainstOwnDepartmentHead: boolean;
}

/**
 * On approval of a `TranscriptRequest`, `generatedDocumentId` gets populated once Documents
 * finishes generating the PDF server-side -- fetch it via `DocumentsApi.getDocument`.
 */
export interface StudentRequestDto {
  readonly id: string;
  readonly studentId: string;
  readonly requestType: StudentRequestType;
  readonly details: string;
  readonly status: StudentRequestStatus;
  readonly reviewScopeNodeId: string | null;
  readonly isAgainstOwnDepartmentHead: boolean;
  readonly generatedDocumentId: string | null;
  readonly decidedByUserId: string | null;
  readonly decisionReason: string | null;
  readonly submittedAt: string;
  readonly decidedAt: string | null;
  readonly fulfilledAt: string | null;
  readonly version: number;
}
