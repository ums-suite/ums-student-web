import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * design-decisions.md "Offline-Cache Reconciliation Trigger — Connectivity-Event-Driven, Not
 * Foreground-Driven" (SWEB-7): reconciliation fires the instant the browser reports `online`,
 * independent of whether the tab is currently focused -- a student can remain foregrounded on a
 * cached, offline dashboard the whole time (a phone with the app open but no signal), so gating
 * reconciliation on foreground-change alone would miss exactly that scenario
 * (edge-cases.md "Published Result Notification Arrives While an Offline-Cached Dashboard Is
 * Open").
 *
 * Deliberately a thin, injectable event bus rather than each feature store adding its own
 * `window.addEventListener('online', ...)` -- one listener, many subscribers (Dashboard's
 * attention panel, the Results store once SWEB-17 lands), so the "reconcile on reconnect, not
 * merely on foreground" rule is enforced in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityReconciliationService {
  private readonly document = inject(DOCUMENT);
  private readonly reconciledSubject = new Subject<void>();

  /** Fires once per `online` transition. Subscribers should force-refresh their own read state. */
  readonly reconciled$ = this.reconciledSubject.asObservable();

  constructor() {
    this.document.defaultView?.addEventListener('online', () => this.reconciledSubject.next());
  }
}
