import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsInputComponent,
  UmsOfflineBannerComponent,
  UmsSkeletonComponent,
  type BadgeVariant,
} from '@ums/design-system';
import type { FineStatus } from '../../core/api/library.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { daysUntilDue, isClaimWindowExpired } from './library.logic';
import { LibraryStore } from './library.store';

const FINE_STATUS_TONE: Readonly<Record<FineStatus, BadgeVariant>> = {
  Accruing: 'danger',
  PendingSettlement: 'warning',
  Paid: 'success',
  Waived: 'neutral',
};

/**
 * Library screen (SWEB-26/27, requirement-spec.md §3.7). See `LibraryStore`'s own class doc for
 * the confirmed backend gap governing the reservation-rejection messaging.
 */
@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsInputComponent,
    UmsOfflineBannerComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss',
})
export class LibraryComponent {
  protected readonly store = inject(LibraryStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);

  protected readonly searchText = signal('');
  protected readonly now = signal(new Date());

  protected readonly lastUpdatedLabel = computed(() => {
    const fetchedAt = this.store.fetchedAt();
    return fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '';
  });

  constructor() {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected search(): void {
    const q = this.searchText().trim();
    if (q) {
      this.store.searchBooks({ q });
    }
  }

  protected renew(loanId: string): void {
    this.store.renewLoan(loanId);
  }

  protected reserve(bookId: string): void {
    this.store.reserveBook(bookId);
  }

  protected settleFine(fineId: string): void {
    this.store.settleFine(fineId);
  }

  protected daysUntilDueFor(dueDate: string): number {
    return daysUntilDue(dueDate, this.now());
  }

  protected isReservationExpired(claimWindowExpiresAt: string | null): boolean {
    return isClaimWindowExpired(claimWindowExpiresAt, this.now());
  }

  protected fineStatusVariant(status: FineStatus): BadgeVariant {
    return FINE_STATUS_TONE[status];
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
