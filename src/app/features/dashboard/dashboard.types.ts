import type { InvoiceDto } from '../../core/api/finance.types';
import type { AllocationDto } from '../../core/api/hostel.types';
import type { ProgramDto } from '../../core/api/academic.types';
import type { StudentDto } from '../../core/api/student.types';

/** One "what needs your attention" item (§3.1). */
export interface AttentionItem {
  readonly id: string;
  readonly messageKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly actionPath?: string;
}

/** A single point on the (unofficial preview) semester score trend sparkline. */
export interface SemesterScorePoint {
  readonly semesterId: string;
  readonly averageScore: number;
}

/** Aggregated view-model the Dashboard renders -- composed client-side from several module reads (no backend dashboard-summary endpoint exists, confirmed gap). */
export interface DashboardSnapshot {
  readonly student: StudentDto;
  readonly program: ProgramDto | null;
  readonly outstandingInvoices: readonly InvoiceDto[];
  readonly outstandingBalance: number;
  readonly currencyCode: string | null;
  readonly allocation: AllocationDto | null;
  readonly overallAverageScore: number | null;
  readonly semesterScoreTrend: readonly SemesterScorePoint[];
  readonly attentionItems: readonly AttentionItem[];
  readonly fetchedAt: number;
}
