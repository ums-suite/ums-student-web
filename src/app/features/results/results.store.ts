import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (SWEB-6) -- fleshed out in SWEB-17/SWEB-18/SWEB-19 (published-only Grade/GPA/
 * transcript). Invariant §8.1 ("Published-result visibility is absolute") governs every future
 * addition here: this store must never hold or expose a `Grade`/`ResultPublication` that has not
 * reached `Published` state, under any code path -- noted now so the constraint is on record
 * before the store gains any real data.
 */
@Injectable({ providedIn: 'root' })
export class ResultsStore {
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
}
