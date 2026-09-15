import { Injectable, computed, inject, signal } from '@angular/core';
import { CurrentUserService, type UmsApiError } from '@ums/shared';
import { UmsToastService } from '@ums/design-system';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AcademicApi } from '../../core/api/academic.api';
import type {
  AcademicSessionDto,
  CourseDto,
  CourseOfferingDto,
  EnrollmentDto,
  ProgramDto,
  SectionDto,
  SemesterDto,
} from '../../core/api/academic.types';
import { StudentApi } from '../../core/api/student.api';
import { APP_CONFIG } from '../../core/config/app-config';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { shortPoll } from '../../core/realtime/short-poll';
import { TranslationService } from '../../core/i18n/translation.service';
import {
  buildEligibility,
  classifyEnrollmentError,
  computeRegistrationWindowStatus,
  isStatusRejection,
} from './registration-eligibility';
import type {
  EligibilityResult,
  OfferingViewModel,
  RegistrationWindowStatus,
  ScheduleSelection,
  TrackedEnrollment,
} from './registration.types';
import { WaitlistApi } from './waitlist.api';
import type { WaitlistPositionResponse } from './registration.types';

const STORAGE_PREFIX = 'ums-student-web:registration:enrollments:';

/**
 * Registration store (SWEB-11 through SWEB-15) -- the highest-scrutiny feature area in this
 * app's scope. Owns: the offering browser + live seat/window poll (SWEB-11), pre-submission
 * eligibility (SWEB-12, delegated to the pure `registration-eligibility.ts` module), register/
 * drop actions with explicit `Enrollment` status (SWEB-13), the in-progress "my schedule"
 * selection (SWEB-14), and waitlist join/confirm (SWEB-15, against an assumed contract --
 * `waitlist.api.ts`).
 *
 * **Confirmed backend gap this store works around, flagged in the PR**: `ums-core`'s Academic
 * module exposes no "list academic sessions"/"current session" discovery endpoint -- only
 * `GET /academic-sessions/{id}` once the id is already known. This store therefore requires an
 * `AcademicSession` id to be supplied ({@link loadSession}) rather than auto-discovering "the
 * current semester" the way a finished product would. Once such a discovery endpoint ships, only
 * {@link loadSession}'s caller needs to change, not this store's internals.
 *
 * **Confirmed gap #2**: no "list my enrollments" endpoint exists (only get-by-id) -- this store
 * tracks enrollment ids it creates in `localStorage` (same-browser-only, mirroring
 * `ums-admission-web`'s `WizardDraftStore` pattern) and re-fetches each by id.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationStore {
  private readonly academicApi = inject(AcademicApi);
  private readonly studentApi = inject(StudentApi);
  private readonly waitlistApi = inject(WaitlistApi);
  private readonly currentUser = inject(CurrentUserService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(UmsToastService);
  private readonly translation = inject(TranslationService);
  private readonly appConfig = inject(APP_CONFIG);

  private readonly courseCache = new Map<string, CourseDto>();
  private pollSubscription: Subscription | null = null;

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  private readonly studentIdState = signal<string | null>(null);
  private readonly maxCreditsState = signal<number>(18);
  private readonly completedCourseIdsState = signal<ReadonlySet<string>>(new Set());

  private readonly sessionState = signal<AcademicSessionDto | null>(null);
  private readonly semesterState = signal<SemesterDto | null>(null);
  private readonly windowStatusState = signal<RegistrationWindowStatus>('unknown');
  private readonly offeringsState = signal<readonly OfferingViewModel[]>([]);

  private readonly searchTextState = signal('');
  private readonly departmentFilterState = signal<string | null>(null);

  private readonly selectionsState = signal<readonly ScheduleSelection[]>([]);
  private readonly trackedEnrollmentsState = signal<readonly TrackedEnrollment[]>([]);

  private readonly waitlistStatusState = signal<
    ReadonlyMap<string, WaitlistPositionResponse | null>
  >(new Map());

  /** Set once a registration-adjacent call returns a status-related rejection (design-decisions.md "Registration Feature-Area Exit"). The component watches this and performs the full redirect. */
  private readonly statusRedirectMessageState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly session = this.sessionState.asReadonly();
  readonly semester = this.semesterState.asReadonly();
  readonly windowStatus = this.windowStatusState.asReadonly();
  readonly offerings = this.offeringsState.asReadonly();
  readonly searchText = this.searchTextState.asReadonly();
  readonly departmentFilter = this.departmentFilterState.asReadonly();
  readonly selections = this.selectionsState.asReadonly();
  readonly trackedEnrollments = this.trackedEnrollmentsState.asReadonly();
  readonly waitlistStatuses = this.waitlistStatusState.asReadonly();
  readonly statusRedirectMessage = this.statusRedirectMessageState.asReadonly();

  readonly departments = computed(() => {
    const ids = new Set(this.offeringsState().map((o) => o.offering.departmentId));
    return Array.from(ids);
  });

  readonly filteredOfferings = computed(() => {
    const search = this.searchTextState().trim().toLowerCase();
    const department = this.departmentFilterState();

    return this.offeringsState().filter((vm) => {
      const matchesDepartment = !department || vm.offering.departmentId === department;
      const matchesSearch =
        !search ||
        vm.course?.code.toLowerCase().includes(search) ||
        vm.course?.title.toLowerCase().includes(search);
      return matchesDepartment && matchesSearch;
    });
  });

  readonly scheduleCreditsTotal = computed(() =>
    this.selectionsState().reduce((total, s) => total + s.creditHours, 0),
  );

  setSearchText(text: string): void {
    this.searchTextState.set(text);
  }

  setDepartmentFilter(departmentId: string | null): void {
    this.departmentFilterState.set(departmentId);
  }

  /** Entry point -- see class doc for why an `AcademicSession` id must be supplied explicitly. */
  loadSession(academicSessionId: string): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.statusRedirectMessageState.set(null);

    forkJoin({
      student: this.studentApi.getMyProfile(),
      session: this.academicApi.getAcademicSession(academicSessionId),
    }).subscribe({
      next: ({ student, session }) => {
        this.studentIdState.set(student.id);
        this.sessionState.set(session);

        const semester = selectActiveSemester(session.semesters, new Date());
        this.semesterState.set(semester);

        forkJoin({
          program: this.academicApi
            .getProgram(student.programId)
            .pipe(catchError(() => of<ProgramDto | null>(null))),
          results: this.academicApi
            .getMyPublishedResults(student.id)
            .pipe(catchError(() => of([]))),
        }).subscribe(({ program, results }) => {
          this.maxCreditsState.set(program?.maxCreditsPerSemester ?? 18);
          this.completedCourseIdsState.set(new Set(results.map((r) => r.courseId)));

          if (semester) {
            this.loadTrackedEnrollments(student.id, semester.id);
            this.startPolling(semester.id);
          } else {
            this.loadingState.set(false);
          }
        });
      },
      error: (error: UmsApiError) => {
        this.loadingState.set(false);
        this.errorState.set(error.message || 'registration.error');
      },
    });
  }

  /** SWEB-11 + design-decisions.md "RegistrationWindow ... Piggybacks on the Existing Seat-Poll Channel": one poll refreshes offerings (seat counts) and recomputes window status together. */
  private startPolling(semesterId: string): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = shortPoll(
      () => this.academicApi.listCourseOfferings(semesterId),
      this.appConfig.pollIntervalMs,
    ).subscribe({
      next: (offerings) => this.applyOfferings(offerings),
      error: () => {
        // A transient poll failure never blanks an already-rendered offering list.
        this.loadingState.set(false);
      },
    });
  }

  stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }

  private applyOfferings(offerings: readonly CourseOfferingDto[]): void {
    const semester = this.semesterState();
    if (semester) {
      this.windowStatusState.set(computeRegistrationWindowStatus(semester, new Date()));
    }

    this.resolveCourses(offerings).subscribe((viewModels) => {
      this.offeringsState.set(viewModels);
      this.loadingState.set(false);

      // Piggyback joined-waitlist status refresh onto the same poll cycle (SWEB-15, reusing
      // SWEB-8/SWEB-11's already-built poll channel rather than a second loop).
      for (const offeringId of this.waitlistStatusState().keys()) {
        this.refreshWaitlistStatus(offeringId);
      }
    });
  }

  private resolveCourses(offerings: readonly CourseOfferingDto[]) {
    const fetches = offerings.map((offering) => {
      const cached = this.courseCache.get(offering.courseId);
      if (cached) {
        return of<OfferingViewModel>({ offering, course: cached });
      }
      return this.academicApi.getCourse(offering.courseId).pipe(
        map((course) => {
          this.courseCache.set(offering.courseId, course);
          return { offering, course } satisfies OfferingViewModel;
        }),
        catchError(() => of<OfferingViewModel>({ offering, course: null })),
      );
    });
    return fetches.length > 0 ? forkJoin(fetches) : of<OfferingViewModel[]>([]);
  }

  /** SWEB-12: a display-only, non-authoritative preview -- see `registration-eligibility.ts`. */
  computeEligibility(
    offering: CourseOfferingDto,
    course: CourseDto | null,
    section: SectionDto,
  ): EligibilityResult {
    return buildEligibility({
      course,
      section,
      candidateCreditHours: course?.creditHours ?? 0,
      completedCourseIds: this.completedCourseIdsState(),
      currentSelections: this.selectionsState(),
      maxCreditsPerSemester: this.maxCreditsState(),
      hasAvailableSeats: offering.hasAvailableSeats,
    });
  }

  /** SWEB-14: adds to the in-progress "my schedule" panel -- not yet submitted. */
  addToSchedule(selection: ScheduleSelection): void {
    if (this.selectionsState().some((s) => s.offeringId === selection.offeringId)) {
      return;
    }
    this.selectionsState.update((list) => [...list, selection]);
  }

  removeFromSchedule(offeringId: string): void {
    this.selectionsState.update((list) => list.filter((s) => s.offeringId !== offeringId));
  }

  /**
   * SWEB-13: submits a register call, **always re-validating server-side regardless of what the
   * eligibility preview showed** (edge-cases.md "Prerequisite/curriculum change mid-registration").
   * Never renders an optimistic "registered" state before the server confirms (design-decisions.md
   * "Seat-Gauge Trust Boundary": "no optimistic success path exists for registration submission").
   */
  register(
    offering: CourseOfferingDto,
    section: SectionDto,
    course: CourseDto | null,
    onSettled?: (rejectionReason?: string) => void,
  ): void {
    if (!this.connectivity.isOnline()) {
      this.toast.show(this.translation.t('registration.error.generic'), { variant: 'danger' });
      onSettled?.('offline');
      return;
    }

    this.academicApi
      .createEnrollment({
        courseOfferingId: offering.id,
        sectionId: section.id,
        prerequisiteOverrideReason: null,
      })
      .subscribe({
        next: (enrollment) => {
          this.trackEnrollment(enrollment, course, section);
          this.removeFromSchedule(offering.id);
          this.toast.show(this.translation.t('registration.status.' + enrollment.status), {
            variant: 'success',
          });
          onSettled?.();
        },
        error: (error: UmsApiError) => this.handleEnrollmentError(error, offering, onSettled),
      });
  }

  /** SWEB-13, Invariant §8.5: drop is a status transition (`Dropped`), the enrollment is retained in `trackedEnrollments`, never removed. */
  drop(
    enrollmentId: string,
    reason: string | null,
    onSettled?: (rejectionReason?: string) => void,
  ): void {
    if (!this.connectivity.isOnline()) {
      this.toast.show(this.translation.t('registration.error.generic'), { variant: 'danger' });
      onSettled?.('offline');
      return;
    }

    this.academicApi.dropEnrollment(enrollmentId, { reason }).subscribe({
      next: (enrollment) => {
        this.trackedEnrollmentsState.update((list) =>
          list.map((e) =>
            e.enrollmentId === enrollment.id ? { ...e, status: enrollment.status } : e,
          ),
        );
        this.toast.show(this.translation.t('registration.status.Dropped'), { variant: 'success' });
        onSettled?.();
      },
      error: (error: UmsApiError) => {
        const reason = classifyEnrollmentError(error);
        if (isStatusRejection(reason)) {
          this.triggerStatusRedirect(error);
        } else {
          this.toast.show(this.translation.t(`registration.error.${reason}`), {
            variant: 'danger',
          });
        }
        onSettled?.(reason);
      },
    });
  }

  private handleEnrollmentError(
    error: UmsApiError,
    offering: CourseOfferingDto,
    onSettled?: (rejectionReason?: string) => void,
  ): void {
    const reason = classifyEnrollmentError(error);

    if (isStatusRejection(reason)) {
      this.triggerStatusRedirect(error);
      onSettled?.(reason);
      return;
    }

    if (reason === 'seatUnavailable') {
      // design-decisions.md "Seat-Gauge Trust Boundary": immediate offering-scoped reconciliation.
      this.academicApi.getCourseOffering(offering.id).subscribe((fresh) => {
        this.offeringsState.update((list) =>
          list.map((vm) => (vm.offering.id === fresh.id ? { ...vm, offering: fresh } : vm)),
        );
      });
      this.toast.show(this.translation.t('registration.seatTaken'), { variant: 'danger' });
      onSettled?.(reason);
      return;
    }

    if (reason === 'windowClosed') {
      this.windowStatusState.set('closed');
    }

    this.toast.show(this.translation.t(`registration.error.${reason}`), { variant: 'danger' });
    onSettled?.(reason);
  }

  private triggerStatusRedirect(error: UmsApiError): void {
    const status = error.message || 'unavailable';
    this.statusRedirectMessageState.set(
      this.translation.t('registration.statusRedirect.body', { status }),
    );
  }

  clearStatusRedirect(): void {
    this.statusRedirectMessageState.set(null);
  }

  // -- Waitlist (SWEB-15, assumed contract -- see WaitlistApi's own doc comment) --

  joinWaitlist(offeringId: string): void {
    this.waitlistApi.joinWaitlist(offeringId).subscribe((status) => {
      if (status === null) {
        this.toast.show(this.translation.t('registration.waitlist.notAvailable'), {
          variant: 'info',
        });
        return;
      }
      this.waitlistStatusState.update((map) => new Map(map).set(offeringId, status));
    });
  }

  refreshWaitlistStatus(offeringId: string): void {
    this.waitlistApi.getMyWaitlistStatus(offeringId).subscribe((status) => {
      this.waitlistStatusState.update((map) => new Map(map).set(offeringId, status));
    });
  }

  confirmWaitlistOffer(offeringId: string, onSettled?: (rejectionReason?: string) => void): void {
    this.waitlistApi.confirmWaitlistOffer(offeringId).subscribe({
      next: () => {
        this.toast.show(this.translation.t('registration.waitlist.offer.confirm'), {
          variant: 'success',
        });
        onSettled?.();
      },
      error: (error: UmsApiError) => {
        const reason = classifyEnrollmentError(error);
        this.toast.show(this.translation.t('registration.waitlist.offer.expired'), {
          variant: 'danger',
        });
        onSettled?.(reason);
      },
    });
  }

  private loadTrackedEnrollments(studentId: string, semesterId: string): void {
    const ids = this.readStoredEnrollmentIds(studentId, semesterId);
    if (ids.length === 0) {
      this.trackedEnrollmentsState.set([]);
      return;
    }

    forkJoin(
      ids.map((id) => this.academicApi.getEnrollment(id).pipe(catchError(() => of(null)))),
    ).subscribe((enrollments) => {
      const resolved = enrollments.filter((e): e is EnrollmentDto => e !== null);
      forkJoin(
        resolved.map((enrollment) =>
          forkJoin({
            offering: this.academicApi
              .getCourseOffering(enrollment.courseOfferingId)
              .pipe(catchError(() => of(null))),
          }).pipe(map(({ offering }) => ({ enrollment, offering }))),
        ),
      ).subscribe((pairs) => {
        const tracked: TrackedEnrollment[] = [];
        for (const { enrollment, offering } of pairs) {
          const course = offering ? this.courseCache.get(offering.courseId) : undefined;
          tracked.push({
            enrollmentId: enrollment.id,
            status: enrollment.status,
            offeringId: enrollment.courseOfferingId,
            sectionId: enrollment.sectionId,
            courseCode: course?.code ?? '',
            courseTitle: course?.title ?? '',
            creditHours: enrollment.creditHours,
          });
        }
        this.trackedEnrollmentsState.set(tracked);
      });
    });
  }

  private trackEnrollment(
    enrollment: EnrollmentDto,
    course: CourseDto | null,
    section: SectionDto,
  ): void {
    this.trackedEnrollmentsState.update((list) => [
      ...list,
      {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        offeringId: enrollment.courseOfferingId,
        sectionId: section.id,
        courseCode: course?.code ?? '',
        courseTitle: course?.title ?? '',
        creditHours: enrollment.creditHours,
      },
    ]);

    const studentId = this.studentIdState();
    const semesterId = this.semesterState()?.id;
    if (studentId && semesterId) {
      this.writeStoredEnrollmentIds(studentId, semesterId, [
        ...this.readStoredEnrollmentIds(studentId, semesterId),
        enrollment.id,
      ]);
    }
  }

  private storageKey(studentId: string, semesterId: string): string {
    return `${STORAGE_PREFIX}${studentId}:${semesterId}`;
  }

  private readStoredEnrollmentIds(studentId: string, semesterId: string): readonly string[] {
    try {
      const raw = localStorage.getItem(this.storageKey(studentId, semesterId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private writeStoredEnrollmentIds(
    studentId: string,
    semesterId: string,
    ids: readonly string[],
  ): void {
    try {
      localStorage.setItem(this.storageKey(studentId, semesterId), JSON.stringify(ids));
    } catch {
      // Best-effort only -- a private-browsing/storage-disabled session simply loses same-browser
      // enrollment tracking, never breaks registration itself.
    }
  }
}

/** No "current semester" flag exists (confirmed gap) -- prefers whichever semester's registration window is open right now, falling back to the most recently-starting one. */
function selectActiveSemester(semesters: readonly SemesterDto[], now: Date): SemesterDto | null {
  if (semesters.length === 0) {
    return null;
  }
  const open = semesters.find((s) => computeRegistrationWindowStatus(s, now) === 'open');
  if (open) {
    return open;
  }
  return [...semesters].sort((a, b) => b.registrationStart.localeCompare(a.registrationStart))[0];
}
