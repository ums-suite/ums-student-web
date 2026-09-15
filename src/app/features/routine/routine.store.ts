import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (SWEB-6) -- fleshed out in SWEB-16 (weekly routine calendar/grid, exam-period
 * overlay). Kept as a minimal signal-store shape now so the app shell's routing/store wiring
 * pattern is established uniformly across every feature module, per requirement-spec.md §2 State
 * management row ("scaffold them now, flesh out as their own tickets land").
 */
@Injectable({ providedIn: 'root' })
export class RoutineStore {
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
}
