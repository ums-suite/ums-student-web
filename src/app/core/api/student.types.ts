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
