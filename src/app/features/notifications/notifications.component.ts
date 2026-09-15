import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsOfflineBannerComponent,
  UmsSkeletonComponent,
} from '@ums/design-system';
import {
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
} from '../../core/api/notifications.types';
import { PushOptInService } from '../../core/pwa/push-opt-in.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { OPT_OUTABLE_CATEGORIES } from './notification-preferences.util';
import { NotificationsStore } from './notifications.store';

const ALL_CATEGORIES: readonly NotificationCategory[] = [
  'Otp',
  'SecurityAlert',
  'Payment',
  'Result',
  'Transactional',
  'Informational',
];

/**
 * Notifications screen (SWEB-29/30, requirement-spec.md §3.8): bilingual Notice feed, in-app
 * notification center, opt-in push registration, and per-channel preference settings. See
 * `NotificationsStore`/`PushOptInService`'s own class docs for the confirmed backend gaps this
 * screen is built honestly around (no real-time transport, no preference endpoint, no push
 * subscription endpoint).
 */
@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsOfflineBannerComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  protected readonly store = inject(NotificationsStore);
  protected readonly pushOptIn = inject(PushOptInService);
  private readonly translation = inject(TranslationService);

  protected readonly categories = ALL_CATEGORIES;
  protected readonly channels = NOTIFICATION_CHANNELS;
  protected readonly optOutableCategories = OPT_OUTABLE_CATEGORIES;

  constructor() {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected markRead(id: string): void {
    this.store.markRead(id);
  }

  protected markAllRead(): void {
    this.store.markAllRead();
  }

  protected requestPushOptIn(): void {
    void this.pushOptIn.requestOptIn();
  }

  protected disablePush(): void {
    this.pushOptIn.optOut();
  }

  protected isNoticeFallback(noticeId: string): boolean {
    return this.store.noticesShownInFallbackLanguage().has(noticeId);
  }

  protected isCategoryOptOutable(category: NotificationCategory): boolean {
    return this.optOutableCategories.includes(category);
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
