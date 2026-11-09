import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatReportMonthLong,
  formatReportWeekdayLong,
  formatReportYmdDisplay,
  localizeRevenueBreakdownRows,
} from '@/lib/report-display-labels';

test('formatReportWeekdayLong uses French locale', () => {
  assert.equal(formatReportWeekdayLong('2026-11-08', 'fr'), 'dimanche');
});

test('formatReportWeekdayLong uses German locale', () => {
  assert.equal(formatReportWeekdayLong('2026-11-08', 'de'), 'Sonntag');
});

test('formatReportMonthLong uses French locale', () => {
  assert.equal(formatReportMonthLong(11, 'fr'), 'novembre');
});

test('formatReportMonthLong uses German locale', () => {
  assert.equal(formatReportMonthLong(11, 'de'), 'November');
});

test('localizeRevenueBreakdownRows localizes day rows', () => {
  const t = (key: string) => (key === 'reportsCalendarWeek' ? 'KW' : key);
  const rows = localizeRevenueBreakdownRows(
    [
      {
        id: '2026-11-08',
        label: '08.11.2026',
        sublabel: 'Sunday',
        total: 10,
        from: '2026-11-08',
        to: '2026-11-08',
      },
    ],
    'days',
    'de',
    t
  );
  assert.equal(rows[0]?.sublabel, 'Sonntag');
  assert.match(rows[0]?.label || '', /08/);
});

test('formatReportYmdDisplay renders Swiss-style numerals', () => {
  const fr = formatReportYmdDisplay('2026-03-05', 'fr');
  assert.ok(fr.includes('05'));
  assert.ok(fr.includes('2026'));
});
