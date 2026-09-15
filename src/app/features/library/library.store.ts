import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (SWEB-6) -- fleshed out in SWEB-26/SWEB-27 (catalog search, loans, reservations).
 */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
}
