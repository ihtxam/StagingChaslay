import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import { browserPrintText } from '@/lib/print-agent';

type EodSlice = {
  range: { label: string; from: string; to: string };
  revenue: number;
  tipsTotal: number;
  discountTotal: number;
  taxTotal: number;
  refundTotal: number;
  grandTotal: number;
  paymentRows: Array<{ method: string; count: number; total: number }>;
  userPerformance?: Array<{ name: string; salesCount: number; total: number }>;
};

type Props = {
  open: boolean;
  from: string;
  to: string;
  title: string;
  onClose: () => void;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

export default function RevenuePeriodSummaryModal({ open, from, to, title, onClose }: Props) {
  const { t, formatDate } = useI18n();
  const [report, setReport] = useState<EodSlice | null>(null);
  const [loading, setLoading] = useState(false);

  const periodLabel = useMemo(() => {
    if (from === to) {
      try {
        return formatDate(new Date(`${from}T12:00:00`));
      } catch {
        return from;
      }
    }
    return `${from} – ${to}`;
  }, [from, to, formatDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset: 'custom', from, to });
      const res = await api.get(`/merchant/reports/eod?${params}`);
      setReport(res.data.report as EodSlice);
    } catch {
      toast.error(t('reportsLoadFailed'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const buildPrintText = () => {
    if (!report) return '';
    const lines = [
      t('reportsTabRevenue'),
      periodLabel,
      '',
      `${t('reportsNetSalesExclTips')}: ${money(report.revenue)}`,
      `  ${t('reportsTips')}: ${money(report.tipsTotal)}`,
      `  ${t('reportsTax')}: ${money(report.taxTotal)}`,
      `${t('reportsRefunds')}: ${money(report.refundTotal)}`,
      `${t('reportsGrandTotal')}: ${money(report.grandTotal)}`,
      '',
      t('reportsByPayment'),
    ];
    for (const row of report.paymentRows || []) {
      lines.push(`  ${paymentMethodLabel(row.method, t)} · QTY ${row.count}: ${money(row.total)}`);
    }
    if (report.userPerformance?.length) {
      lines.push('', t('reportsTabUsers'));
      for (const u of report.userPerformance) {
        lines.push(`  ${u.name}: ${money(u.total)}`);
      }
    }
    return lines.join('\n');
  };

  const printSummary = () => {
    const text = buildPrintText();
    if (!text) return;
    browserPrintText(text);
  };

  const shareSummary = async () => {
    const text = buildPrintText();
    if (!text) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t('reportsTabRevenue'), text });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label={t('cancel')}
        onClick={onClose}
      />

      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title || t('reportsTabRevenue')}</h2>
            <p className="text-xs text-[var(--text-muted)]">{periodLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
              onClick={printSummary}
              disabled={!report || loading}
              aria-label={t('reportsPrintEod')}
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
              onClick={() => void shareSummary()}
              disabled={!report || loading}
              aria-label={t('reportsRevenueShare')}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
              onClick={onClose}
              aria-label={t('cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm muted">{t('loading')}</p>
          ) : !report ? (
            <p className="text-sm muted">{t('reportsEmpty')}</p>
          ) : (
            <>
              <section className="rounded-xl border border-[var(--border)] p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{t('reportsNetSalesExclTips')}</span>
                  <span className="font-semibold tabular-nums">{money(report.revenue)}</span>
                </div>
                <div className="flex justify-between gap-2 text-xs pl-2">
                  <span className="text-[var(--text-muted)]">{t('reportsTips')}</span>
                  <span className="tabular-nums">{money(report.tipsTotal)}</span>
                </div>
                <div className="flex justify-between gap-2 text-xs pl-2">
                  <span className="text-[var(--text-muted)]">{t('reportsTax')}</span>
                  <span className="tabular-nums">{money(report.taxTotal)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{t('reportsRefunds')}</span>
                  <span className="tabular-nums">{money(report.refundTotal)}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-2 font-semibold">
                  <span>{t('reportsGrandTotal')}</span>
                  <span className="tabular-nums">{money(report.grandTotal)}</span>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                <h3 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                  {t('reportsByPayment')}
                </h3>
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {!report.paymentRows?.length ? (
                    <li className="px-3 py-3 muted">{t('reportsEmpty')}</li>
                  ) : (
                    report.paymentRows.map((row) => (
                      <li key={row.method} className="flex justify-between gap-2 px-3 py-2.5">
                        <span>
                          {paymentMethodLabel(row.method, t)} · QTY {row.count}
                        </span>
                        <span className="font-medium tabular-nums">{money(row.total)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {report.userPerformance?.length ? (
                <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <h3 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                    {t('reportsTabUsers')}
                  </h3>
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {report.userPerformance.map((u) => (
                      <li key={u.name} className="flex justify-between gap-2 px-3 py-2.5">
                        <span className="truncate">{u.name}</span>
                        <span className="font-medium tabular-nums shrink-0">{money(u.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
