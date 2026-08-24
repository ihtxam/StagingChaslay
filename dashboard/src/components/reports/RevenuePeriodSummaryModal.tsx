import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import { printThermalReportTextSafe } from '@/lib/print-thermal-report';
import {
  generateRevenuePeriodSummaryText,
  resolveReceiptLanguage,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';

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

function debitMoney(n: number) {
  return Number(n) > 0.001 ? `−${money(n)}` : money(n);
}

const UNASSIGNED_STAFF_KEY = 'Unassigned';

export default function RevenuePeriodSummaryModal({ open, from, to, title, onClose }: Props) {
  const { t, formatDate, locale } = useI18n();
  const [report, setReport] = useState<EodSlice | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);

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

  const staffNameLabel = useCallback(
    (name: string) => (name === UNASSIGNED_STAFF_KEY ? t('reportsUnassignedSales') : name),
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset: 'custom', from, to });
      const [repRes, setRes] = await Promise.all([
        api.get(`/merchant/reports/eod?${params}`),
        api.get('/merchant/settings'),
      ]);
      setReport(repRes.data.report as EodSlice);
      const s = setRes.data.settings;
      setPrintSettings(s?.posPrintSettings || null);
      setBusinessName(s?.name || '');
      setShopLogoUrl(s?.shopLogoUrl || s?.posPrintSettings?.receiptLogoUrl || null);
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

  const buildThermalText = () => {
    if (!report) return '';
    const lang = resolveReceiptLanguage(printSettings, locale);
    return generateRevenuePeriodSummaryText({
      title: title || t('reportsTabRevenue'),
      periodLabel,
      revenue: report.revenue,
      tipsTotal: report.tipsTotal,
      taxTotal: report.taxTotal,
      refundTotal: report.refundTotal,
      grandTotal: report.grandTotal,
      paymentRows: report.paymentRows || [],
      userPerformance: report.userPerformance?.map((u) => ({
        name: u.name,
        total: u.total,
      })),
      businessName,
      language: lang,
      paperWidthMm: printSettings?.paperWidthMm || 80,
      header: printSettings?.receiptHeader,
      footer: printSettings?.receiptFooter,
      labels: {
        netSalesExclTips: t('reportsNetSalesExclTips'),
        tips: t('reportsTips'),
        tax: t('reportsTax'),
        refunds: t('reportsRefunds'),
        grandTotal: t('reportsGrandTotal'),
        byPayment: t('reportsByPayment'),
        userPerformance: t('reportsTabUsers'),
        qty: 'QTY',
      },
      paymentMethodLabel: (method) => paymentMethodLabel(method, t),
      staffNameLabel,
    });
  };

  const printSummary = async () => {
    const text = buildThermalText();
    if (!text || printing) return;
    setPrinting(true);
    try {
      await printThermalReportTextSafe({
        text,
        printSettings,
        logoUrl: printSettings?.receiptLogoUrl || shopLogoUrl,
        t,
      });
    } finally {
      setPrinting(false);
    }
  };

  const showUnassignedHint = report?.userPerformance?.some(
    (u) => u.name === UNASSIGNED_STAFF_KEY
  );

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
              className="rounded-lg p-2 hover:bg-[var(--bg-muted)] disabled:opacity-50"
              onClick={() => void printSummary()}
              disabled={!report || loading || printing}
              aria-label={t('reportsPrintEod')}
            >
              <Printer className="h-4 w-4" />
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
                  <span className="tabular-nums">{debitMoney(report.refundTotal)}</span>
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
                  {showUnassignedHint ? (
                    <p className="px-3 py-2 text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                      {t('reportsUnassignedHint')}
                    </p>
                  ) : null}
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {report.userPerformance.map((u) => (
                      <li key={u.name} className="flex justify-between gap-2 px-3 py-2.5">
                        <span className="truncate">{staffNameLabel(u.name)}</span>
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
