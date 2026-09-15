import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (SWEB-6) -- fleshed out in SWEB-23/SWEB-24/SWEB-25 (application, allocation,
 * complaints). Invariant §8.6 ("Hostel Allocation is one-active-per-student") governs every
 * future addition here -- noted now so nothing built in this pass conflicts with it later.
 */
@Injectable({ providedIn: 'root' })
export class HostelStore {
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
}
