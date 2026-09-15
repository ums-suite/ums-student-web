import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsCardComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsOfflineBannerComponent,
  UmsProgressBarComponent,
  UmsSkeletonComponent,
} from '@ums/design-system';
import type { InvoiceDto } from '../../core/api/finance.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { isConfirmedPaymentStatus } from './payment-idempotency';
import { FeesStore } from './fees.store';

/**
 * Fees/Payment screen (SWEB-20/21/22, requirement-spec.md §3.5/§7). See `FeesStore`'s own class
 * doc for the idempotency-key persistence mechanism this screen's "processing your payment" state
 * relies on -- a reload/relaunch after a gateway redirect resumes into the same calm processing
 * view automatically via `FeesStore.load()`, never a re-prompt to pay again (edge-cases.md
 * "Payment gateway timeout or webhook lag").
 */
@Component({
  selector: 'app-fees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsCardComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsOfflineBannerComponent,
    UmsProgressBarComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './fees.component.html',
  styleUrl: './fees.component.scss',
})
export class FeesComponent {
  protected readonly store = inject(FeesStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);
  private readonly document = inject(DOCUMENT);

  protected readonly lastUpdatedLabel = computed(() => {
    const fetchedAt = this.store.fetchedAt();
    return fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '';
  });

  protected readonly totalAllInvoiceAmount = computed(() =>
    this.store.invoices().reduce((sum, invoice) => sum + invoice.totalAmount, 0),
  );
  protected readonly paidAmount = computed(
    () => this.totalAllInvoiceAmount() - this.store.outstandingBalance(),
  );

  protected readonly isConfirmedSuccess = computed(() => {
    const status = this.store.paymentStatus();
    return status !== null && isConfirmedPaymentStatus(status.status);
  });

  constructor() {
    this.store.load();

    // The gateway redirect itself is a real external navigation -- once a redirectUrl arrives
    // from a fresh initiation, leave the app for the gateway's own hosted flow (§3.5: "this app
    // never collects or stores raw payment credentials; it redirects to/embeds the gateway's own
    // hosted flow"). A resumed attempt (reload after redirect) never re-receives a redirectUrl, so
    // this never re-fires on its own.
    effect(() => {
      const url = this.store.redirectUrl();
      if (url) {
        this.document.defaultView?.location.assign(url);
      }
    });
  }

  protected retry(): void {
    this.store.load();
  }

  protected selectInvoice(invoice: InvoiceDto): void {
    this.store.selectInvoiceForPayment(invoice);
  }

  protected pay(): void {
    this.store.initiatePayment();
  }

  protected acknowledgeUnconfirmed(): void {
    this.store.acknowledgePendingDispatchResolved();
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
