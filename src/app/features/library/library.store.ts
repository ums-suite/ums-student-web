import { Injectable, computed, inject, signal } from '@angular/core';
import type { UmsApiError } from '@ums/shared';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LibraryApi } from '../../core/api/library.api';
import type {
  BookSearchPageDto,
  FineDto,
  LoanDto,
  ReservationDto,
} from '../../core/api/library.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { classifyReservationError } from './library.logic';

/** Known `LoanEndpoints` renewal rejection codes (`LoanService`, confirmed) mapped to specific i18n keys -- never a generic message when the server told us exactly why. */
const RENEW_ERROR_KEYS: Readonly<Record<string, string>> = {
  'loan.already_returned': 'library.renew.error.alreadyReturned',
  'loan.already_lost_write_off': 'library.renew.error.lostWriteOff',
  'loan.reservation_queue_blocks_renewal': 'library.renew.error.queueBlocks',
  'loan.max_renewals_exceeded': 'library.renew.error.maxRenewals',
};

/**
 * Library store (SWEB-26/27, requirement-spec.md §3.7). Unlike most of this app's other feature
 * modules, `loans/me`, `reservations/me`, and `fines/me` are all genuine, confirmed list
 * endpoints (`library.api.ts` doc) -- no same-browser id-tracking workaround is needed here.
 *
 * **Confirmed gap governing the reservation flow (SWEB-27)**: see `library.logic.ts`
 * `ReservationRejectionReason`'s own doc for why edge-cases.md's literal "someone reserved this
 * just before you" race cannot occur against the real backend (an uncapped reservation queue) --
 * this store surfaces the one real, closely-related rejection (`reservation.copy_available`)
 * with a specific, honest message instead.
 */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly libraryApi = inject(LibraryApi);
  private readonly connectivity = inject(ConnectivityService);
  private readonly reconciliation = inject(ConnectivityReconciliationService);

  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly fetchedAtState = signal<number | null>(null);

  private readonly loansState = signal<readonly LoanDto[]>([]);
  private readonly reservationsState = signal<readonly ReservationDto[]>([]);
  private readonly finesState = signal<readonly FineDto[]>([]);

  private readonly searchResultsState = signal<BookSearchPageDto | null>(null);
  private readonly searchingState = signal(false);
  private readonly reservationErrorState = signal<string | null>(null);
  private readonly renewErrorState = signal<string | null>(null);
  private readonly settleErrorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly fetchedAt = this.fetchedAtState.asReadonly();

  readonly loans = this.loansState.asReadonly();
  readonly reservations = this.reservationsState.asReadonly();
  readonly fines = this.finesState.asReadonly();

  readonly activeLoans = computed(() => this.loansState().filter((l) => l.status === 'Active'));
  readonly overdueLoans = computed(() => this.activeLoans().filter((l) => l.isOverdue));
  readonly outstandingFines = computed(() =>
    this.finesState().filter((f) => f.status === 'Accruing' || f.status === 'PendingSettlement'),
  );

  readonly searchResults = this.searchResultsState.asReadonly();
  readonly searching = this.searchingState.asReadonly();
  readonly reservationError = this.reservationErrorState.asReadonly();
  readonly renewError = this.renewErrorState.asReadonly();
  readonly settleError = this.settleErrorState.asReadonly();

  constructor() {
    this.reconciliation.reconciled$.subscribe(() => this.load());
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);

    forkJoin({
      loans: this.libraryApi.getMyLoans().pipe(catchError(() => of<LoanDto[]>([]))),
      reservations: this.libraryApi
        .getMyReservations()
        .pipe(catchError(() => of<ReservationDto[]>([]))),
      fines: this.libraryApi.getMyFines().pipe(catchError(() => of<FineDto[]>([]))),
    }).subscribe(({ loans, reservations, fines }) => {
      this.loansState.set(loans);
      this.reservationsState.set(reservations);
      this.finesState.set(fines);
      this.loadingState.set(false);
      this.fetchedAtState.set(Date.now());
    });
  }

  searchBooks(query: { q?: string; categoryId?: string; page?: number }): void {
    this.searchingState.set(true);
    this.libraryApi.searchBooks(query).subscribe({
      next: (page) => {
        this.searchResultsState.set(page);
        this.searchingState.set(false);
      },
      error: () => this.searchingState.set(false),
    });
  }

  /** SWEB-26. Never queues offline (consistent with §4's "hostel/library mutating actions require connectivity"). */
  renewLoan(id: string): void {
    this.renewErrorState.set(null);
    if (!this.connectivity.isOnline()) {
      this.renewErrorState.set('library.offline');
      return;
    }
    this.libraryApi.renewLoan(id).subscribe({
      next: () => this.load(),
      error: (error: UmsApiError) => {
        const known = error.code && RENEW_ERROR_KEYS[error.code];
        this.renewErrorState.set(known ?? 'library.renew.error.generic');
      },
    });
  }

  /** SWEB-27: see class/`library.logic.ts` doc for the real rejection reasons surfaced here. */
  reserveBook(bookId: string): void {
    this.reservationErrorState.set(null);
    if (!this.connectivity.isOnline()) {
      this.reservationErrorState.set('library.offline');
      return;
    }
    this.libraryApi.reserveBook(bookId).subscribe({
      next: () => this.load(),
      error: (error: UmsApiError) => {
        const reason = classifyReservationError(error);
        this.reservationErrorState.set(`library.reservation.error.${reason}`);
      },
    });
  }

  /** Only initiates settlement (creates a Finance Invoice) -- the fine's own `status` flips to `Paid` asynchronously once payment is confirmed, observed by re-`load`ing. */
  settleFine(id: string): void {
    this.settleErrorState.set(null);
    if (!this.connectivity.isOnline()) {
      this.settleErrorState.set('library.offline');
      return;
    }
    this.libraryApi.settleFine(id).subscribe({
      next: () => this.load(),
      error: () => this.settleErrorState.set('library.fine.settle.error'),
    });
  }
}
