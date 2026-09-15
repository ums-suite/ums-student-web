import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { UmsToastService } from '@ums/design-system';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsConfirmationDialogComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsFormFieldComponent,
  UmsInputComponent,
  UmsOfflineBannerComponent,
  UmsProgressBarComponent,
  UmsSelectComponent,
  UmsSkeletonComponent,
  type SelectOption,
} from '@ums/design-system';
import type { CourseOfferingDto, SectionDto } from '../../core/api/academic.types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { canDispatchWaitlistConfirm, computeWaitlistCountdown } from './waitlist-countdown';
import { DEFAULT_LOW_SEAT_THRESHOLD, seatGaugeTone, seatsRemaining } from './seat-gauge';
import { RegistrationStore } from './registration.store';
import { SchedulePanelComponent } from './schedule-panel.component';
import type { OfferingViewModel, ScheduleSelection, TrackedEnrollment } from './registration.types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Course Registration screen (SWEB-11 through SWEB-15) -- requirement-spec.md §3.2/§7. See
 * `RegistrationStore`'s own class doc for the two confirmed backend gaps this screen works
 * around (no session-discovery endpoint, no "list my enrollments" endpoint).
 */
@Component({
  selector: 'app-registration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsConfirmationDialogComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsFormFieldComponent,
    UmsInputComponent,
    UmsOfflineBannerComponent,
    UmsProgressBarComponent,
    UmsSelectComponent,
    UmsSkeletonComponent,
    SchedulePanelComponent,
    TranslatePipe,
  ],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
})
export class RegistrationComponent {
  protected readonly store = inject(RegistrationStore);
  private readonly router = inject(Router);
  private readonly toast = inject(UmsToastService);
  private readonly translation = inject(TranslationService);

  protected readonly sessionIdInput = signal('');
  protected readonly nowTick = signal(Date.now());
  protected readonly dropConfirmTarget = signal<TrackedEnrollment | null>(null);

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly departmentOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.translation.t('registration.filters.all') },
    ...this.store.departments().map((id) => ({ value: id, label: id })),
  ]);

  constructor() {
    // design-decisions.md "Registration Feature-Area Exit on Student-Status Rejection": a full
    // redirect to Dashboard, not a per-call toast, the instant any registration-adjacent call
    // returns a status-related rejection.
    effect(() => {
      const message = this.store.statusRedirectMessage();
      if (message) {
        this.toast.show(message, { variant: 'danger' });
        this.store.clearStatusRedirect();
        void this.router.navigateByUrl('/dashboard');
      }
    });
  }

  protected loadSession(): void {
    const id = this.sessionIdInput().trim();
    if (!id) {
      return;
    }
    this.store.loadSession(id);
    this.startTicking();
  }

  protected dayLabel(dayOfWeek: number): string {
    return DAY_LABELS[dayOfWeek] ?? String(dayOfWeek);
  }

  protected seatsRemainingFor(offering: CourseOfferingDto): number {
    return seatsRemaining(offering);
  }

  protected seatToneFor(offering: CourseOfferingDto): 'success' | 'warning' | 'danger' {
    return seatGaugeTone(offering, DEFAULT_LOW_SEAT_THRESHOLD);
  }

  protected eligibilityFor(vm: OfferingViewModel, section: SectionDto) {
    return this.store.computeEligibility(vm.offering, vm.course, section);
  }

  protected addSection(vm: OfferingViewModel, section: SectionDto): void {
    this.store.addToSchedule({
      offeringId: vm.offering.id,
      sectionId: section.id,
      courseCode: vm.course?.code ?? '',
      courseTitle: vm.course?.title ?? '',
      creditHours: vm.course?.creditHours ?? 0,
      section,
    });
  }

  protected registerSelection(selection: ScheduleSelection): void {
    const vm = this.store.offerings().find((o) => o.offering.id === selection.offeringId);
    if (!vm) {
      return;
    }
    this.store.register(vm.offering, selection.section, vm.course);
  }

  protected removeSelection(offeringId: string): void {
    this.store.removeFromSchedule(offeringId);
  }

  protected requestDrop(enrollment: TrackedEnrollment): void {
    this.dropConfirmTarget.set(enrollment);
  }

  protected confirmDrop(reason: string): void {
    const target = this.dropConfirmTarget();
    if (!target) {
      return;
    }
    this.store.drop(target.enrollmentId, reason || null);
    this.dropConfirmTarget.set(null);
  }

  protected cancelDrop(): void {
    this.dropConfirmTarget.set(null);
  }

  protected joinWaitlist(offeringId: string): void {
    this.store.joinWaitlist(offeringId);
  }

  protected waitlistStatusFor(offeringId: string) {
    return this.store.waitlistStatuses().get(offeringId) ?? null;
  }

  protected countdownFor(offeringId: string) {
    const status = this.waitlistStatusFor(offeringId);
    if (!status?.offer) {
      return null;
    }
    return computeWaitlistCountdown(status.offer.expiresAt, new Date(this.nowTick()));
  }

  protected confirmWaitlistOffer(offeringId: string): void {
    const countdown = this.countdownFor(offeringId);
    if (!countdown || !canDispatchWaitlistConfirm(countdown)) {
      return;
    }
    this.store.confirmWaitlistOffer(offeringId);
  }

  protected retry(): void {
    const id = this.sessionIdInput().trim();
    if (id) {
      this.store.loadSession(id);
    }
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickTimer = setInterval(() => this.nowTick.set(Date.now()), 1000);
  }

  private stopTicking(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
