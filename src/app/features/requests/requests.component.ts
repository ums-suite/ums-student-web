import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  UmsButtonComponent,
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
import type { StudentRequestStatus, StudentRequestType } from '../../core/api/student.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { RequestsStore } from './requests.store';

const STATUS_TONE: Readonly<Record<StudentRequestStatus, BadgeVariant>> = {
  Submitted: 'info',
  UnderReview: 'info',
  Approved: 'success',
  Rejected: 'danger',
  Fulfilled: 'success',
};

/** Requests screen (SWEB-28, requirement-spec.md §3.8). See `RequestsStore`'s own class doc for the confirmed "no list" gap this works around. */
@Component({
  selector: 'app-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsButtonComponent,
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
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent {
  protected readonly store = inject(RequestsStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);

  protected readonly requestType = signal<StudentRequestType>('IdReissue');
  protected readonly reason = signal('');
  protected readonly purpose = signal('');
  protected readonly description = signal('');
  protected readonly isAgainstOwnDepartmentHead = signal(false);

  protected readonly typeOptions: SelectOption[] = [
    { value: 'IdReissue', label: 'ID reissue' },
    { value: 'TranscriptRequest', label: 'Transcript request' },
    { value: 'Grievance', label: 'Grievance' },
  ];

  protected readonly timelineEntries = computed<TimelineEntry[]>(() =>
    this.store.requests().map((request) => ({
      title: `${this.translation.t(`requests.type.${request.requestType}`)} — ${this.translation.t(`requests.status.${request.status}`)}`,
      timestamp: request.submittedAt,
      description: request.decisionReason ?? undefined,
      status: STATUS_TONE[request.status],
    })),
  );

  constructor() {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected onTypeChange(value: string): void {
    this.requestType.set(value as StudentRequestType);
  }

  protected submit(): void {
    const type = this.requestType();
    this.store.submit(type, {
      reason: type === 'IdReissue' ? this.reason().trim() || null : null,
      purpose: type === 'TranscriptRequest' ? this.purpose().trim() || null : null,
      description: type === 'Grievance' ? this.description().trim() || null : null,
      isAgainstOwnDepartmentHead: type === 'Grievance' ? this.isAgainstOwnDepartmentHead() : false,
    });
    this.reason.set('');
    this.purpose.set('');
    this.description.set('');
    this.isAgainstOwnDepartmentHead.set(false);
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
