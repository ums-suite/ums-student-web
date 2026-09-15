import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsCardComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsLineChartComponent,
  UmsOfflineBannerComponent,
  UmsSelectComponent,
  UmsSkeletonComponent,
  type ChartSeries,
  type SelectOption,
} from '@ums/design-system';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { ResultsStore } from './results.store';

/**
 * Grades/Transcript/GPA screen (SWEB-17/18/19, requirement-spec.md §3.4/§7). Every figure this
 * template renders traces back to `ResultsStore`'s own Invariant §8.1/§8.4 discipline -- see its
 * class doc. The per-semester accordion uses native `<details>`/`<summary>` (no design-system
 * accordion primitive exists) for a zero-dependency, fully-accessible disclosure pattern.
 */
@Component({
  selector: 'app-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsCardComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsLineChartComponent,
    UmsOfflineBannerComponent,
    UmsSelectComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss',
})
export class ResultsComponent {
  protected readonly store = inject(ResultsStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);

  protected readonly pdfLocale = signal<'en' | 'bn'>('en');

  protected readonly localeOptions: SelectOption[] = [
    { value: 'en', label: 'English' },
    { value: 'bn', label: 'বাংলা' },
  ];

  protected readonly trendCategories = computed(() =>
    this.store.gpaTrendPoints().map((p) => p.ordinalLabel),
  );

  protected readonly trendSeries = computed<ChartSeries[]>(() => [
    {
      name: this.translation.t('results.gpaTrend.seriesLabel'),
      data: this.store.gpaTrendPoints().map((p) => p.averageScore),
    },
  ]);

  protected readonly lastUpdatedLabel = computed(() => {
    const fetchedAt = this.store.fetchedAt();
    return fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '';
  });

  protected readonly canRequestPdf = computed(() => {
    const status = this.store.transcriptPdfStatus();
    return status === null || status === 'Rejected';
  });

  protected readonly downloadReady = computed(
    () => this.store.transcriptPdfDocument()?.status === 'Ready',
  );

  constructor() {
    this.store.load();
  }

  protected retry(): void {
    this.store.load();
  }

  protected onPdfLocaleChange(value: string): void {
    this.pdfLocale.set(value === 'bn' ? 'bn' : 'en');
  }

  protected courseLabel(courseId: string): string {
    const course = this.store.courseInfo().get(courseId);
    return course ? `${course.code} — ${course.title}` : courseId;
  }

  protected requestTranscriptPdf(): void {
    this.store.requestTranscriptPdf(this.pdfLocale());
  }

  protected refreshPdfStatus(): void {
    this.store.refreshTranscriptPdfStatus();
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
