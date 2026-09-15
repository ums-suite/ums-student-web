import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * The single source of truth for "is this device online right now" (SWEB-7, requirement-spec.md
 * §4 Offline tolerance row / §8.3 "Money-moving actions never queue offline").
 *
 * Every screen that must hard-block a mutating action while offline (registration register/drop,
 * SWEB-13; later payment/hostel/library mutations) reads {@link isOnline} rather than re-deriving
 * its own `navigator.onLine` check, so the "what counts as offline" definition lives in one place.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly document = inject(DOCUMENT);

  private readonly onlineState = signal(this.readNavigatorOnline());

  readonly isOnline = this.onlineState.asReadonly();

  constructor() {
    const win = this.document.defaultView;
    win?.addEventListener('online', () => this.onlineState.set(true));
    win?.addEventListener('offline', () => this.onlineState.set(false));
  }

  private readNavigatorOnline(): boolean {
    const win = this.document.defaultView;
    // `navigator.onLine` defaults to `true` when unavailable (e.g. some test/SSR environments) --
    // never treat an unknown state as "definitely offline", which would incorrectly block a
    // mutating action that could actually succeed.
    return win?.navigator?.onLine ?? true;
  }
}
