import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (SWEB-6) -- fleshed out in SWEB-20/SWEB-21/SWEB-22 (invoices, gateway payment,
 * post-redirect status polling). Invariant §8.3 ("Money-moving actions never queue offline")
 * governs every future addition here.
 */
@Injectable({ providedIn: 'root' })
export class FeesStore {
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
}
