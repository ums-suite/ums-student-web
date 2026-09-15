import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const STORAGE_KEY = 'ums-student-web:notifications:push-opt-in';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Opt-in browser push registration (SWEB-29, requirement-spec.md §3.8: "opt-in browser push for
 * high-value alerts... never defaulted on without consent"). {@link optedIn} starts `false` and
 * is only ever set `true` by an explicit call to {@link requestOptIn} that itself resolves to a
 * granted `Notification.permission` -- never inferred, never defaulted.
 *
 * **Confirmed gap, deliberately not worked around**: `ums-core`'s Notifications module has no
 * push-subscription-registration endpoint at all despite modeling `Push` as a
 * `NotificationChannel` enum member (`notifications.types.ts` doc) -- there is no VAPID public key
 * or subscribe-target this app could call even if it wanted to create a real
 * `PushSubscription` via `PushManager.subscribe()`. This service therefore only ever requests and
 * records the browser permission + the student's own opt-in intent locally; it never creates a
 * `PushSubscription` object it could not actually register anywhere, and every screen using this
 * must say so plainly rather than imply push delivery is actually wired end-to-end.
 */
@Injectable({ providedIn: 'root' })
export class PushOptInService {
  private readonly document = inject(DOCUMENT);

  private readonly optedInState = signal(this.readStoredOptIn());
  readonly optedIn = this.optedInState.asReadonly();

  readonly permissionState = signal<PushPermissionState>(this.readCurrentPermission());

  /** Only ever called from an explicit student action (a settings toggle) -- never on app load. */
  async requestOptIn(): Promise<void> {
    const win = this.document.defaultView;
    if (!win || typeof win.Notification === 'undefined') {
      this.permissionState.set('unsupported');
      return;
    }

    const permission = await win.Notification.requestPermission();
    this.permissionState.set(permission);
    if (permission === 'granted') {
      this.setOptedIn(true);
    }
  }

  optOut(): void {
    this.setOptedIn(false);
  }

  private setOptedIn(value: boolean): void {
    this.optedInState.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Best-effort only -- a private-browsing session simply loses the persisted opt-in choice.
    }
  }

  private readStoredOptIn(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private readCurrentPermission(): PushPermissionState {
    const win = this.document.defaultView;
    if (!win || typeof win.Notification === 'undefined') {
      return 'unsupported';
    }
    return win.Notification.permission;
  }
}
