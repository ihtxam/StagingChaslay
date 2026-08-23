import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronRight as RowChevron } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import RevenuePeriodSummaryModal from '@/components/reports/RevenuePeriodSummaryModal';

type RevenueMode = 'days' | 'weeks' | 'months' | 'custom';

type RevenueRow = {
  id: string;
  label: string;
  sublabel?: string;
  total: number;
  from?: string;
  to?: string;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function todayYmd() {
  const z = new Date();
  return new Date(z.getTime() - z.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function ReportsRevenuePanel() {
  const { t, locale } = useI18n();
  const now = new Date();
  const [mode, setMode] = useState<RevenueMode>('days');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(todayYmd());
  const [customTo, setCustomTo] = useState(todayYmd());
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<RevenueRow | null>(null);

  const monthLabel = useMemo(() => {
    const name = MONTH_NAMES[month - 1] || String(month);
    if (locale === 'fr') {
      const fr = [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
      ];
      return `${fr[month - 1] || name} ${year}`;
    }
    if (locale === 'de') {
      const de = [
        'Januar',
        'Februar',
        'März',
        'April',
        'Mai',
        'Juni',
        'Juli',
        'August',
        'September',
        'Oktober',
        'November',
        'Dezember',
      ];
      return `${de[month - 1] || name} ${year}`;
    }
    return `${name} ${year}`;
  }, [locale, month, year]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode,
        year: String(year),
      });
      if (mode !== 'months' && mode !== 'custom') params.set('month', String(month));
      if (mode === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      const res = await api.get(`/merchant/reports/revenue?${params}`);
      setRows(res.data.breakdown?.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, month, year, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const shiftYear = (delta: number) => setYear((y) => y + delta);

  const openRow = (row: RevenueRow) => {
    const from = row.from || row.id;
    const to = row.to || row.from || row.id;
    setSelectedRow({ ...row, from, to });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-muted)] w-fit gap-0.5">
        {(
          [
            ['days', t('reportsRevenueDays')],
            ['weeks', t('reportsRevenueWeeks')],
            ['months', t('reportsRevenueMonth')],
            ['custom', t('reportsCustom')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-md px-3 py-2 text-sm ${
              mode === id
                ? 'bg-[var(--bg-elevated)] shadow-sm font-medium'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'custom' ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsFrom')}</span>
            <input
              type="date"
              className="input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsTo')}</span>
            <input
              type="date"
              className="input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <button type="button" className="btn-primary" onClick={() => void load()}>
            {t('reportsApply')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-muted)]"
            onClick={() => (mode === 'months' ? shiftYear(-1) : shiftMonth(-1))}
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {mode === 'months' ? String(year) : monthLabel}
          </h2>
          <button
            type="button"
            className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-muted)]"
            onClick={() => (mode === 'months' ? shiftYear(1) : shiftMonth(1))}
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">{t('reportsRevenueTapHint')}</p>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm muted">{t('loading')}</p>
        ) : rows.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-[var(--bg-muted)]/40"
                  onClick={() => openRow(row)}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{row.label}</p>
                    {row.sublabel ? (
                      <p className="text-sm text-[var(--text-muted)]">{row.sublabel}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="tabular-nums font-medium">{money(row.total)}</p>
                    <RowChevron className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm muted text-center">{t('reportsEmpty')}</p>
        )}
      </div>

      {selectedRow ? (
        <RevenuePeriodSummaryModal
          open
          from={selectedRow.from || selectedRow.id}
          to={selectedRow.to || selectedRow.from || selectedRow.id}
          title={selectedRow.label}
          onClose={() => setSelectedRow(null)}
        />
      ) : null}
    </div>
  );
}
