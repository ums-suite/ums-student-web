import { Injectable, inject, signal } from '@angular/core';
import type { UmsApiError } from '@ums/shared';
import { catchError, forkJoin, of } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type {
  AcademicSessionDto,
  CourseOfferingDto,
  EnrollmentDto,
  SemesterDto,
} from '../../core/api/academic.types';
import { OrganizationApi } from '../../core/api/organization.api';
import type {
  OrganizationBuildingDto,
  OrganizationRoomDto,
} from '../../core/api/organization.types';
import { StudentApi } from '../../core/api/student.api';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { readTrackedEnrollmentIds } from '../../core/state/enrollment-tracking.util';
import { selectActiveSemester } from '../../core/state/semester-selection.util';
import type { RoutineBlock, RoutineExamGroup } from './routine.types';

/**
 * Routine store (SWEB-16, requirement-spec.md §3.3). Renders the weekly grid + exam list from the
 * student's own tracked `Enrollment`s -- the exact same same-browser localStorage mechanism
 * `RegistrationStore` already uses (`core/state/enrollment-tracking.util.ts`), since no bulk
 * "list my enrollments"/"my routine" endpoint exists server-side (confirmed gap, this flow's own
 * Academic-module research). A course registered from a different browser/device is therefore
 * invisible here too -- the same confirmed limitation `RegistrationStore` already documents, not a
 * new one this store introduces.
 *
 * **Confirmed gap, SectionDto has no room field**: every {@link RoutineBlock.roomId} is `null` --
 * see `routine.types.ts`'s own doc. The "where is this room" affordance is therefore a general
 * building/room directory ({@link loadBuildings}/{@link loadRoomsForBuilding}), not a per-class
 * resolved link.
 *
 * **Confirmed gap, Exam has no scheduled date**: {@link examGroups} carries exam name +
 * assessments only, never a date -- there is nothing to overlay onto a specific grid cell
 * (`routine.types.ts` `RoutineExamGroup` doc).
 *
 * Reconciles on reconnect, not merely on foreground (design-decisions.md "Offline-Cache
 * Reconciliation Trigger"), matching `DashboardStore`'s own established pattern.
 */
@Injectable({ providedIn: 'root' })
export class RoutineStore {
  private readonly academicApi = inject(AcademicApi);
  private readonly studentApi = inject(StudentApi);
  private readonly organizationApi = inject(OrganizationApi);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly blocksState = signal<readonly RoutineBlock[]>([]);
  private readonly examGroupsState = signal<readonly RoutineExamGroup[]>([]);
  private readonly sessionState = signal<AcademicSessionDto | null>(null);
  private readonly semesterState = signal<SemesterDto | null>(null);
  private readonly fetchedAtState = signal<number | null>(null);

  private readonly buildingsState = signal<readonly OrganizationBuildingDto[]>([]);
  private readonly roomsState = signal<readonly OrganizationRoomDto[]>([]);
  private readonly roomDirectoryLoadingState = signal(false);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly blocks = this.blocksState.asReadonly();
  readonly examGroups = this.examGroupsState.asReadonly();
  readonly session = this.sessionState.asReadonly();
  readonly semester = this.semesterState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  readonly buildings = this.buildingsState.asReadonly();
  readonly rooms = this.roomsState.asReadonly();
  readonly roomDirectoryLoading = this.roomDirectoryLoadingState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => {
      const sessionId = this.sessionState()?.id;
      if (sessionId) {
        this.loadSession(sessionId);
      }
    });
  }

  /** Same confirmed gap as `RegistrationStore.loadSession` -- no session-discovery endpoint exists, so the caller supplies the id explicitly. */
  loadSession(academicSessionId: string): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    forkJoin({
      student: this.studentApi.getMyProfile(),
      session: this.academicApi.getAcademicSession(academicSessionId),
    }).subscribe({
      next: ({ student, session }) => {
        this.sessionState.set(session);
        const semester = selectActiveSemester(session.semesters, new Date());
        this.semesterState.set(semester);

        if (!semester) {
          this.blocksState.set([]);
          this.examGroupsState.set([]);
          this.loadingState.set(false);
          this.fetchedAtState.set(Date.now());
          return;
        }

        this.loadRoutine(student.id, semester.id);
      },
      error: (error: UmsApiError) => {
        this.loadingState.set(false);
        this.errorState.set(error.message || 'routine.error');
      },
    });
  }

  private loadRoutine(studentId: string, semesterId: string): void {
    const ids = readTrackedEnrollmentIds(studentId, semesterId);
    if (ids.length === 0) {
      this.blocksState.set([]);
      this.examGroupsState.set([]);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
      return;
    }

    forkJoin(
      ids.map((id) => this.academicApi.getEnrollment(id).pipe(catchError(() => of(null)))),
    ).subscribe((enrollments) => {
      const active = enrollments.filter(
        (e): e is EnrollmentDto => e !== null && (e.status === 'Active' || e.status === 'Pending'),
      );

      if (active.length === 0) {
        this.blocksState.set([]);
        this.examGroupsState.set([]);
        this.loadingState.set(false);
        this.fetchedAtState.set(Date.now());
        return;
      }

      forkJoin(
        active.map((enrollment) =>
          forkJoin({
            offering: this.academicApi
              .getCourseOffering(enrollment.courseOfferingId)
              .pipe(catchError(() => of(null))),
          }),
        ),
      ).subscribe((offeringResults) => {
        const resolvedPairs = active
          .map((enrollment, index) => ({ enrollment, offering: offeringResults[index]?.offering }))
          .filter(
            (pair): pair is { enrollment: EnrollmentDto; offering: CourseOfferingDto } =>
              !!pair.offering,
          );

        this.resolveCoursesAndBuild(resolvedPairs);
      });
    });
  }

  private resolveCoursesAndBuild(
    pairs: readonly { enrollment: EnrollmentDto; offering: CourseOfferingDto }[],
  ): void {
    if (pairs.length === 0) {
      this.blocksState.set([]);
      this.examGroupsState.set([]);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
      return;
    }

    forkJoin(
      pairs.map((pair) =>
        this.academicApi.getCourse(pair.offering.courseId).pipe(catchError(() => of(null))),
      ),
    ).subscribe((courses) => {
      const blocks: RoutineBlock[] = [];
      const examGroups: RoutineExamGroup[] = [];

      pairs.forEach((pair, index) => {
        const course = courses[index];
        const courseCode = course?.code ?? '';
        const courseTitle = course?.title ?? '';

        for (const section of pair.offering.sections) {
          blocks.push({
            enrollmentId: pair.enrollment.id,
            offeringId: pair.offering.id,
            sectionId: section.id,
            courseCode,
            courseTitle,
            creditHours: pair.enrollment.creditHours,
            dayOfWeek: section.dayOfWeek,
            start: section.start,
            end: section.end,
            roomId: null,
          });
        }

        for (const exam of pair.offering.exams) {
          examGroups.push({
            offeringId: pair.offering.id,
            courseCode,
            courseTitle,
            examId: exam.id,
            examName: exam.name,
            assessments: exam.assessments,
          });
        }
      });

      this.blocksState.set(blocks);
      this.examGroupsState.set(examGroups);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
    });
  }

  // -- Room directory ("where is this room", SWEB-16 -- general lookup, see class doc) --

  loadBuildings(): void {
    this.roomDirectoryLoadingState.set(true);
    this.roomsState.set([]);
    this.organizationApi.listBuildings().subscribe({
      next: (page) => {
        this.buildingsState.set(page.items);
        this.roomDirectoryLoadingState.set(false);
      },
      error: () => this.roomDirectoryLoadingState.set(false),
    });
  }

  loadRoomsForBuilding(buildingId: string): void {
    this.roomDirectoryLoadingState.set(true);
    this.organizationApi.listRoomsForBuilding(buildingId).subscribe({
      next: (page) => {
        this.roomsState.set(page.items);
        this.roomDirectoryLoadingState.set(false);
      },
      error: () => this.roomDirectoryLoadingState.set(false),
    });
  }
}
