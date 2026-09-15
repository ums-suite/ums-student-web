import type { InvoiceDto } from '../../core/api/finance.types';
import type { StudentResultRowDto } from '../../core/api/academic.types';
import type { AttentionItem, SemesterScorePoint } from './dashboard.types';

/** Pure dashboard aggregation logic (SWEB-9/SWEB-10) -- kept free of HttpClient/DI/signals so it is trivially unit-testable, mirroring `ums-admission-web`'s "pure logic lives outside the component/store" convention. */

export function greetingKeyForHour(hour: number): string {
  if (hour < 12) {
    return 'dashboard.greeting.morning';
  }
  if (hour < 18) {
    return 'dashboard.greeting.afternoon';
  }
  return 'dashboard.greeting.evening';
}

export function sumOutstandingBalance(invoices: readonly InvoiceDto[]): number {
  return invoices
    .filter((invoice) => invoice.status === 'Open')
    .reduce((total, invoice) => total + invoice.totalAmount, 0);
}

/**
 * Requirement-spec.md §3.1: "a rotating 'what needs your attention' panel (registration window
 * open, fee due soon, low-attendance warning if the backend surfaces one, unread
 * ResultPublication) -- never a static, identical-for-everyone home screen."
 *
 * Low-attendance is omitted: no backend surface for it exists (confirmed -- Academic has no
 * attendance-summary read endpoint), and the spec itself only requires surfacing it "if the
 * backend surfaces one."
 */
export function buildAttentionItems(input: {
  readonly outstandingBalance: number;
  readonly currencyCode: string | null;
  readonly unreadNotificationCount: number;
  readonly registrationWindowOpen: boolean;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.registrationWindowOpen) {
    items.push({
      id: 'registration-open',
      messageKey: 'dashboard.attention.registrationOpen',
      actionPath: '/registration',
    });
  }

  if (input.outstandingBalance > 0) {
    items.push({
      id: 'fee-due',
      messageKey: 'dashboard.attention.feeDue',
      params: {
        amount: `${input.currencyCode ?? ''} ${input.outstandingBalance.toFixed(2)}`.trim(),
      },
      actionPath: '/fees',
    });
  }

  if (input.unreadNotificationCount > 0) {
    items.push({
      id: 'unread-notices',
      messageKey: 'dashboard.attention.unreadNotices',
      params: { count: input.unreadNotificationCount },
    });
  }

  return items;
}

/**
 * An **unofficial preview** trend only -- Invariant §8.4 ("GPA/CGPA is never client-recomputed as
 * authoritative... any client-side preview must be visually and textually distinguished as
 * unofficial"). The one authoritative figure is `TranscriptDto.overallAverageScore`
 * (backend-computed); this groups already-published result rows (Invariant §8.1 -- the source
 * endpoint is Published-only by construction) by semester and averages `calculatedScore`
 * purely for a compact visual sparkline, ordered by each group's earliest `publishedAt`.
 */
export function buildSemesterScoreTrend(
  results: readonly StudentResultRowDto[],
): SemesterScorePoint[] {
  const bySemester = new Map<
    string,
    { total: number; count: number; earliestPublishedAt: string }
  >();

  for (const row of results) {
    const existing = bySemester.get(row.semesterId);
    if (existing) {
      existing.total += row.calculatedScore;
      existing.count += 1;
      if (row.publishedAt < existing.earliestPublishedAt) {
        existing.earliestPublishedAt = row.publishedAt;
      }
    } else {
      bySemester.set(row.semesterId, {
        total: row.calculatedScore,
        count: 1,
        earliestPublishedAt: row.publishedAt,
      });
    }
  }

  return Array.from(bySemester.entries())
    .map(([semesterId, agg]) => ({
      semesterId,
      averageScore: agg.total / agg.count,
      earliestPublishedAt: agg.earliestPublishedAt,
    }))
    .sort((a, b) => a.earliestPublishedAt.localeCompare(b.earliestPublishedAt))
    .map(({ semesterId, averageScore }) => ({ semesterId, averageScore }));
}
