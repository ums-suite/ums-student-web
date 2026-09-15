import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContentApi } from '../../core/api/content.api';
import type { NoticeDto } from '../../core/api/content.types';
import { NotificationsApi } from '../../core/api/notifications.api';
import type {
  LocalNotificationPreferences,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryAttemptDto,
} from '../../core/api/notifications.types';
import { LocaleService } from '@ums/shared';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import {
  readLocalNotificationPreferences,
  toggleChannelPreference,
  writeLocalNotificationPreferences,
} from './notification-preferences.util';

/**
 * Notifications store (SWEB-29/30, requirement-spec.md §3.8). Covers the bilingual Notice feed,
 * the in-app notification center, and (SWEB-30) client-local notification-channel preferences.
 *
 * **Confirmed, repo-wide gaps** (see `notifications.types.ts`/`push-opt-in.service.ts` doc for
 * the full detail): no SSE/WebSocket real-time transport exists anywhere server-side (this
 * center is poll/manual-refresh only), no preference read/write endpoint exists (SWEB-30's
 * settings are client-local only, never synced), and no push-subscription endpoint exists despite
 * `Push` being a modeled channel.
 *
 * Bilingual resolution (ADR-0011) happens entirely server-side via the `Accept-Language` header
 * (already globally propagated by `localeInterceptor`) -- `hasBengaliTranslation` on each
 * {@link NoticeDto} is this store's own signal for edge-cases.md "Missing Bengali translation for
 * a Notice", surfaced by the component as a subtle "shown in English" note.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly contentApi = inject(ContentApi);
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly localeService = inject(LocaleService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly fetchedAtState = signal<number | null>(null);

  private readonly noticesState = signal<readonly NoticeDto[]>([]);
  private readonly inboxState = signal<readonly NotificationDeliveryAttemptDto[]>([]);
  private readonly unreadCountState = signal(0);

  private readonly preferencesState = signal<LocalNotificationPreferences>(
    readLocalNotificationPreferences(),
  );

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  readonly notices = this.noticesState.asReadonly();
  readonly inbox = this.inboxState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();

  /** A Notice shown in a language other than what the student actually requested -- edge-cases.md "Missing Bengali translation". */
  readonly noticesShownInFallbackLanguage = computed(() => {
    const wanted = this.localeService.locale();
    return new Set(
      this.noticesState()
        .filter((n) => n.languageCode !== wanted)
        .map((n) => n.id),
    );
  });

  readonly preferences = this.preferencesState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    forkJoin({
      notices: this.contentApi
        .listNoticesFeed('Student')
        .pipe(catchError(() => of<NoticeDto[]>([]))),
      inbox: this.notificationsApi
        .listMyNotifications()
        .pipe(catchError(() => of<NotificationDeliveryAttemptDto[]>([]))),
      unreadCount: this.notificationsApi.getUnreadCount().pipe(catchError(() => of(0))),
    }).subscribe(({ notices, inbox, unreadCount }) => {
      this.noticesState.set(notices);
      this.inboxState.set(inbox);
      this.unreadCountState.set(unreadCount);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
    });
  }

  markRead(id: string): void {
    this.notificationsApi.markRead(id).subscribe(() => this.load());
  }

  markAllRead(): void {
    this.notificationsApi.markAllRead().subscribe(() => this.load());
  }

  /** SWEB-30, client-local only -- see class doc. */
  toggleChannel(category: NotificationCategory, channel: NotificationChannel): void {
    const updated = toggleChannelPreference(this.preferencesState(), category, channel);
    this.preferencesState.set(updated);
    writeLocalNotificationPreferences(updated);
  }
}
