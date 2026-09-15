/**
 * `Notifications` module DTOs (SWEB-29/30), verified against
 * `UMS.Modules.Notifications.Api/Endpoints/NotificationCenterEndpoints.cs` and
 * `UMS.Modules.Notifications.Application/*`.
 *
 * **Confirmed, repo-wide**: no SSE/WebSocket/SignalR real-time transport exists anywhere in
 * `ums-core` (`NotificationChannelService`'s own doc already flagged this as an *assumed* contract
 * for the unread-count badge; this research pass confirms it directly -- a repo-wide grep for
 * SignalR/Hub/ServerSentEvent/WebSocket/PushSubscription/VAPID returned zero matches). Polling
 * this module's own `GET /me/unread-count` is the only real mechanism available today.
 */
export const NOTIFICATION_CHANNELS = ['Email', 'Sms', 'WhatsApp', 'Push', 'InApp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationCategory =
  'Otp' | 'SecurityAlert' | 'Payment' | 'Result' | 'Transactional' | 'Informational';

export interface NotificationDeliveryAttemptDto {
  readonly id: string;
  readonly notificationRequestId: string;
  readonly channel: NotificationChannel;
  readonly status: string;
  readonly attemptCount: number;
  readonly deadLetterReason: string | null;
  readonly lastError: string | null;
  readonly deliveredAt: string | null;
  readonly readAt: string | null;
  readonly renderedSubject: string | null;
  readonly renderedBody: string | null;
  readonly renderedDeepLink: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UnreadCountDto {
  readonly unreadCount: number;
}

/**
 * **Confirmed gap -- not a real backend contract.** `RecipientPreferenceService`/
 * `RecipientNotificationPreference` exist fully in the application layer (category-level opt-out
 * only -- `Informational` is the sole opt-out-able category, every other category is mandatory)
 * but are never wired to any HTTP endpoint (`grep`-confirmed zero references in
 * `Notifications.Api`). This shape is this app's own client-local approximation for SWEB-30's
 * settings screen, persisted to the browser only (never sent to a server that doesn't exist) --
 * every screen using it must say so, not imply it is synced.
 */
export type ChannelPreferenceMap = Readonly<Partial<Record<NotificationChannel, boolean>>>;

export type LocalNotificationPreferences = Readonly<
  Record<NotificationCategory, ChannelPreferenceMap>
>;
