import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

/**
 * In-app notification badge channel (SWEB-8, requirement-spec.md §2 Real-time/live-data row:
 * "SSE/WebSocket (gateway-fronted) for the in-app notification badge").
 *
 * **Flagged, confirmed gap -- built against a documented/assumed contract, not a verified one**:
 * unlike Academic/Student/Finance/Hostel/Library (verified directly against `ums-core`'s own
 * source for this flow), no confirmed `Notifications` module SSE/WebSocket endpoint was found or
 * verified to exist at the time this was built. Per this flow's own instructions ("if no real
 * backend SSE/WS endpoint is confirmed to exist, build the client-side infrastructure against the
 * documented/assumed contract and flag it... don't block on it" -- mirroring how
 * `ums-admission-web` flagged its own assumed-endpoint gaps), this service assumes:
 *
 * - `GET {apiBaseUrl}/api/v1/notifications/stream` is a Server-Sent-Events endpoint (auth via the
 *   same cookie/bearer session as every other call -- `EventSource` cannot attach a custom
 *   `Authorization` header, so this assumes the endpoint accepts the session the same way a
 *   normal navigation request would, e.g. a cookie; this is exactly the kind of contract detail
 *   that needs backend confirmation before this channel can be trusted end-to-end).
 * - Each message's `data` is JSON shaped as {@link NotificationStreamEvent}.
 *
 * Fails closed and quietly: a connection error simply stops updating the badge (never throws,
 * never blocks any other screen) and retries with a fixed backoff -- a missing/wrong backend
 * contract here must never break the rest of the app.
 */
export interface NotificationStreamEvent {
  readonly unreadCount: number;
}

const RECONNECT_DELAY_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class NotificationChannelService implements OnDestroy {
  private readonly appConfig = inject(APP_CONFIG);

  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly unreadCountState = signal(0);
  readonly unreadCount = this.unreadCountState.asReadonly();

  private readonly connectedState = signal(false);
  readonly connected = this.connectedState.asReadonly();

  connect(): void {
    if (this.eventSource || typeof EventSource === 'undefined') {
      return;
    }

    const url = `${this.appConfig.apiBaseUrl}/api/v1/notifications/stream`;
    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => this.connectedState.set(true);

    source.onmessage = (event: MessageEvent<string>) => {
      const parsed = parseNotificationEvent(event.data);
      if (parsed) {
        this.unreadCountState.set(parsed.unreadCount);
      }
    };

    source.onerror = () => {
      this.connectedState.set(false);
      source.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };

    this.eventSource = source;
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectedState.set(false);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Manual reset, e.g. once the student opens the notification center and reads everything. */
  clearUnread(): void {
    this.unreadCountState.set(0);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

function parseNotificationEvent(raw: string): NotificationStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'unreadCount' in parsed &&
      typeof (parsed as { unreadCount: unknown }).unreadCount === 'number'
    ) {
      return parsed as NotificationStreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}
