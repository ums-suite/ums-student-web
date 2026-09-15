import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsCardComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsFormFieldComponent,
  UmsInputComponent,
  UmsOfflineBannerComponent,
  UmsSelectComponent,
  UmsSkeletonComponent,
  UmsTextareaComponent,
  UmsTimelineComponent,
  type BadgeVariant,
  type SelectOption,
  type TimelineEntry,
} from '@ums/design-system';
import type {
  AllocationStatus,
  ComplaintCategory,
  HostelApplicationStatus,
  RoomType,
} from '../../core/api/hostel.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { evaluateEligibilitySelfCheck } from './hostel.logic';
import { HostelStore } from './hostel.store';

const ROOM_TYPES: readonly RoomType[] = [
  'SingleOccupancy',
  'DoubleOccupancy',
  'TripleOccupancy',
  'Dormitory',
];

const APPLICATION_STATUS_TONE: Readonly<Record<HostelApplicationStatus, BadgeVariant>> = {
  Draft: 'neutral',
  Submitted: 'info',
  Ranked: 'info',
  Approved: 'success',
  Waitlisted: 'warning',
  Rejected: 'danger',
  Withdrawn: 'neutral',
};

const ALLOCATION_STATUS_TONE: Readonly<Record<AllocationStatus, BadgeVariant>> = {
  Pending: 'warning',
  FeePaid: 'info',
  Active: 'success',
  CheckedOut: 'neutral',
  Expired: 'danger',
};

/**
 * Hostel screen (SWEB-23/24/25, requirement-spec.md §3.6). See `HostelStore`'s own class doc for
 * the confirmed backend gaps this UI works within (no bed/room-level selection or availability
 * data server-side) and the hard pre-payment re-validation this screen performs.
 */
@Component({
  selector: 'app-hostel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsCardComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsFormFieldComponent,
    UmsInputComponent,
    UmsOfflineBannerComponent,
    UmsSelectComponent,
    UmsSkeletonComponent,
    UmsTextareaComponent,
    UmsTimelineComponent,
    TranslatePipe,
  ],
  templateUrl: './hostel.component.html',
  styleUrl: './hostel.component.scss',
})
export class HostelComponent {
  protected readonly store = inject(HostelStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);

  protected readonly roomTypes = ROOM_TYPES;
  protected readonly selectedRoomType = signal<RoomType>('SingleOccupancy');

  protected readonly yearOfStudy = signal(1);
  protected readonly hasFinancialNeed = signal(false);
  protected readonly homeDistrictDistanceKm = signal<number | null>(null);

  protected readonly complaintCategory = signal<ComplaintCategory>('Maintenance');
  protected readonly complaintDescription = signal('');

  protected readonly windowOptions = computed<SelectOption[]>(() =>
    this.store.applicationWindows().map((w) => ({ value: w.id, label: w.sessionLabel })),
  );
  protected readonly hostelOptions = computed<SelectOption[]>(() =>
    this.store.hostels().map((h) => ({ value: h.id, label: `${h.name} (${h.type})` })),
  );
  protected readonly roomTypeOptions: SelectOption[] = ROOM_TYPES.map((t) => ({
    value: t,
    label: t,
  }));

  protected readonly selectedHostelId = signal('');

  protected readonly eligibilitySelfCheck = computed(() => {
    const window = this.store.selectedWindow();
    if (!window) {
      return null;
    }
    return evaluateEligibilitySelfCheck(window.eligibilityRules, {
      yearOfStudy: this.yearOfStudy(),
      hasFinancialNeed: this.hasFinancialNeed(),
      homeDistrictDistanceKm: this.homeDistrictDistanceKm(),
    });
  });

  protected readonly applicationTimeline = computed<TimelineEntry[]>(() =>
    this.store.applications().map((app) => ({
      title: this.translation.t(`hostel.application.status.${app.status}`),
      timestamp: app.submittedAt ?? app.createdAt,
      description: app.decisionReason ?? undefined,
      status: APPLICATION_STATUS_TONE[app.status],
    })),
  );

  protected readonly allocationStatusVariant = computed<BadgeVariant>(() => {
    const allocation = this.store.activeAllocation();
    return allocation ? ALLOCATION_STATUS_TONE[allocation.status] : 'neutral';
  });

  constructor() {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected onWindowSelected(windowId: string): void {
    const window = this.store.applicationWindows().find((w) => w.id === windowId);
    if (window) {
      this.store.selectWindow(window);
    }
  }

  protected onComplaintCategoryChange(value: string): void {
    this.complaintCategory.set(value as ComplaintCategory);
  }

  protected onRoomTypeChange(value: string): void {
    this.selectedRoomType.set(value as RoomType);
  }

  protected addPreference(): void {
    const hostel = this.store.hostels().find((h) => h.id === this.selectedHostelId());
    if (!hostel) {
      return;
    }
    this.store.addPreferenceToDraft({
      hostelId: hostel.id,
      hostelName: hostel.name,
      preferredRoomType: this.selectedRoomType(),
    });
  }

  protected submitApplication(): void {
    this.store.submitApplication({
      yearOfStudy: this.yearOfStudy(),
      hasFinancialNeed: this.hasFinancialNeed(),
      homeDistrictDistanceKm: this.homeDistrictDistanceKm(),
    });
  }

  protected payHostelFee(): void {
    this.store.initiateHostelFeePayment();
  }

  protected checkOut(): void {
    const allocation = this.store.activeAllocation();
    if (allocation) {
      this.store.checkOut(allocation.id);
    }
  }

  protected submitComplaint(): void {
    const allocation = this.store.activeAllocation();
    if (!allocation || !this.complaintDescription().trim()) {
      return;
    }
    this.store.submitComplaint(
      allocation.id,
      this.complaintCategory(),
      this.complaintDescription().trim(),
    );
    this.complaintDescription.set('');
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
