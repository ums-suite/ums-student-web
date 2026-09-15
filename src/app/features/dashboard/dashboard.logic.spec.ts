import {
  buildAttentionItems,
  buildSemesterScoreTrend,
  greetingKeyForHour,
  sumOutstandingBalance,
} from './dashboard.logic';
import type { InvoiceDto } from '../../core/api/finance.types';
import type { StudentResultRowDto } from '../../core/api/academic.types';

describe('greetingKeyForHour', () => {
  it('returns morning before noon', () => {
    expect(greetingKeyForHour(9)).toBe('dashboard.greeting.morning');
  });

  it('returns afternoon between noon and 6pm', () => {
    expect(greetingKeyForHour(14)).toBe('dashboard.greeting.afternoon');
  });

  it('returns evening from 6pm onward', () => {
    expect(greetingKeyForHour(20)).toBe('dashboard.greeting.evening');
  });

  it('treats exactly midnight as morning', () => {
    expect(greetingKeyForHour(0)).toBe('dashboard.greeting.morning');
  });
});

function invoice(partial: Partial<InvoiceDto>): InvoiceDto {
  return {
    id: 'inv-1',
    sourceModule: 'Finance',
    sourceReferenceId: 'ref-1',
    feeType: 'Tuition',
    ownerId: 'student-1',
    totalAmount: 100,
    currency: 'BDT',
    status: 'Open',
    createdAt: '2026-01-01T00:00:00Z',
    paidAt: null,
    ...partial,
  };
}

describe('sumOutstandingBalance', () => {
  it('sums only Open invoices', () => {
    const total = sumOutstandingBalance([
      invoice({ totalAmount: 100, status: 'Open' }),
      invoice({ totalAmount: 200, status: 'Paid' }),
      invoice({ totalAmount: 50, status: 'Open' }),
    ]);
    expect(total).toBe(150);
  });

  it('returns 0 for no invoices', () => {
    expect(sumOutstandingBalance([])).toBe(0);
  });
});

describe('buildAttentionItems', () => {
  it('is empty when nothing needs attention', () => {
    const items = buildAttentionItems({
      outstandingBalance: 0,
      currencyCode: 'BDT',
      unreadNotificationCount: 0,
      registrationWindowOpen: false,
    });
    expect(items).toEqual([]);
  });

  it('includes a registration-open item when the window is open', () => {
    const items = buildAttentionItems({
      outstandingBalance: 0,
      currencyCode: 'BDT',
      unreadNotificationCount: 0,
      registrationWindowOpen: true,
    });
    expect(items.some((i) => i.id === 'registration-open')).toBeTrue();
  });

  it('includes a fee-due item with a formatted amount when balance is positive', () => {
    const items = buildAttentionItems({
      outstandingBalance: 1500.5,
      currencyCode: 'BDT',
      unreadNotificationCount: 0,
      registrationWindowOpen: false,
    });
    const feeItem = items.find((i) => i.id === 'fee-due');
    expect(feeItem?.params?.['amount']).toBe('BDT 1500.50');
  });

  it('includes an unread-notices item when there are unread notifications', () => {
    const items = buildAttentionItems({
      outstandingBalance: 0,
      currencyCode: null,
      unreadNotificationCount: 3,
      registrationWindowOpen: false,
    });
    expect(items.find((i) => i.id === 'unread-notices')?.params?.['count']).toBe(3);
  });

  it('includes all applicable items together, in a stable order', () => {
    const items = buildAttentionItems({
      outstandingBalance: 100,
      currencyCode: 'BDT',
      unreadNotificationCount: 2,
      registrationWindowOpen: true,
    });
    expect(items.map((i) => i.id)).toEqual(['registration-open', 'fee-due', 'unread-notices']);
  });
});

function resultRow(partial: Partial<StudentResultRowDto>): StudentResultRowDto {
  return {
    enrollmentId: 'enr-1',
    courseOfferingId: 'off-1',
    courseId: 'course-1',
    semesterId: 'sem-1',
    calculatedScore: 80,
    letterGrade: 'A',
    creditHours: 3,
    publishedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('buildSemesterScoreTrend', () => {
  it('returns an empty trend for no results', () => {
    expect(buildSemesterScoreTrend([])).toEqual([]);
  });

  it('averages scores within the same semester', () => {
    const trend = buildSemesterScoreTrend([
      resultRow({ semesterId: 'sem-1', calculatedScore: 80 }),
      resultRow({ semesterId: 'sem-1', calculatedScore: 90 }),
    ]);
    expect(trend).toEqual([{ semesterId: 'sem-1', averageScore: 85 }]);
  });

  it('orders semesters by earliest publishedAt ascending', () => {
    const trend = buildSemesterScoreTrend([
      resultRow({ semesterId: 'sem-2', calculatedScore: 70, publishedAt: '2026-06-01T00:00:00Z' }),
      resultRow({ semesterId: 'sem-1', calculatedScore: 90, publishedAt: '2026-01-01T00:00:00Z' }),
    ]);
    expect(trend.map((p) => p.semesterId)).toEqual(['sem-1', 'sem-2']);
  });
});
