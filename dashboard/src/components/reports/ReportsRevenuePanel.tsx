import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type RevenueMode = 'days' | 'weeks' | 'months';

type RevenueRow = {
  id: string;
  label: string;
  sublabel?: string;
  total: number;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
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
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (mode !== 'months') params.set('month', String(month));
      const res = await api.get(`/merchant/reports/revenue?${params}`);
      setRows(res.data.breakdown?.rows || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const shiftYear = (delta: number) => setYear((y) => y + delta);

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-muted)] w-fit">
        {(
          [
            ['days', t('reportsRevenueDays')],
            ['weeks', t('reportsRevenueWeeks')],
            ['months', t('reportsRevenueMonth')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-md px-4 py-2 text-sm ${
              mode === id
                ? 'bg-[var(--bg-elevated)] shadow-sm font-medium'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm muted">{t('loading')}</p>
        ) : rows.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[var(--bg-muted)]/40"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.label}</p>
                  {row.sublabel ? (
                    <p className="text-sm text-[var(--text-muted)]">{row.sublabel}</p>
                  ) : null}
                </div>
                <p className="tabular-nums font-medium shrink-0">{money(row.total)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm muted text-center">{t('reportsEmpty')}</p>
        )}
      </div>
    </div>
  );
}
