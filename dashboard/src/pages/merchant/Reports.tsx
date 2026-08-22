import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import {
  generateEodReportText,
  logoUrlToEscPos,
  printersForRole,
  resolveReceiptLanguage,
  textToEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import {
  browserPrintText,
  isPrintAgentAvailable,
  isUnsuitableRawPrinter,
  printViaAgent,
  unsuitableRawPrinterMessage,
} from '@/lib/print-agent';
import { toastPrintError } from '@/lib/webpos-print-toast';
import {
  EodIncludeProductsCheckbox,
  useEodIncludeProductsSold,
} from '@/components/EodIncludeProductsCheckbox';
import {
  CashDrawerBreakdown,
  type CashDrawerShift,
} from '@/components/reports/CashDrawerBreakdown';

type EodShiftCash = CashDrawerShift;

type EodReport = {
  range: { label: string; from: string; to: string; preset: string };
  salesScope?: {
    mode: 'all' | 'own';
    staffId?: string | null;
    staffName?: string | null;
  };
  salesCount: number;
  cancelledCount: number;
  revenue: number;
  subtotal: number;
  taxTotal: number;
  netTotal?: number;
  discountTotal: number;
  tipsTotal: number;
  refundTotal: number;
  refundCount?: number;
  cancelledTotal: number;
  cancelledOrders?: Array<{
    orderNumber: string;
    total: number;
    cancelReason?: string | null;
    cancelledAt?: string | null;
  }>;
  refundedOrders?: Array<{
    orderNumber: string;
    total: number;
    refundAmount: number;
    refundReason?: string | null;
    refundedAt?: string | null;
    status?: string;
  }>;
  grandTotal: number;
  coversServed: number | null;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  vatRows?: Array<{ label: string; net: number; tva: number; brut: number }>;
  paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
  refundRows?: Array<{ method: string; total: number }>;
  channelRows: Array<{ channel: string; count: number; total: number }>;
  orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
  productsSold: Array<{ name: string; quantity: number; total: number }>;
  userPerformance?: Array<{ name: string; salesCount: number; total: number }>;
  shiftCash?: EodShiftCash[];
};

type Preset = 'today' | 'yesterday' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';
type Tab = 'eod' | 'sales' | 'products' | 'users';

export default function ReportsPage() {
  const { t, locale, formatDateTime } = useI18n();
  const [tab, setTab] = useState<Tab>('eod');
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<EodReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [eodIncludeProductsSold, setEodIncludeProductsSold] = useEodIncludeProductsSold();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === 'custom') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const [repRes, setRes] = await Promise.all([
        api.get(`/merchant/reports/eod?${params}`),
        api.get('/merchant/settings'),
      ]);
      setReport(repRes.data.report);
      const s = setRes.data.settings;
      setPrintSettings(s?.posPrintSettings || null);
      setBusinessName(s?.name || '');
      setShopLogoUrl(s?.shopLogoUrl || s?.posPrintSettings?.receiptLogoUrl || null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('reportsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [preset, from, to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownOnly = report?.salesScope?.mode === 'own';

  useEffect(() => {
    if (ownOnly && tab === 'users') setTab('eod');
  }, [ownOnly, tab]);

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const printEod = async () => {
    if (!report) return;
    try {
      const lang = resolveReceiptLanguage(printSettings, locale);
      const targets = printersForRole(printSettings, 'eod');
      const paperWidthMm =
        targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
      const text = generateEodReportText({
        label: report.range.label,
        periodFrom: report.range.from,
        periodTo: report.range.to,
        scopeStaffName:
          report.salesScope?.mode === 'own'
            ? report.salesScope.staffName || null
            : null,
        salesCount: report.salesCount,
        revenue: report.revenue,
        subtotal: report.subtotal || report.revenue,
        taxTotal: report.taxTotal,
        netTotal: report.netTotal,
        tipsTotal: report.tipsTotal,
        grandTotal: report.grandTotal,
        refundTotal: report.refundTotal,
        refundCount: report.refundedOrders?.length ?? report.refundCount,
        refundedOrders: report.refundedOrders?.map((r) => ({
          orderNumber: r.orderNumber,
          refundAmount: r.refundAmount,
          refundReason: r.refundReason,
        })),
        refundRows: report.refundRows,
        cancelledCount: report.cancelledCount,
        cancelledTotal: report.cancelledTotal,
        cashTotal: report.cashTotal,
        cardTotal: report.cardTotal,
        terminalTotal: report.terminalTotal,
        coversServed: report.coversServed,
        vatRows: report.vatRows,
        productsSold: report.productsSold,
        paymentRows: report.paymentRows,
        orderTypeRows: report.orderTypeRows,
        channelRows: report.channelRows,
        businessName,
        language: lang,
        paperWidthMm,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
        includeProductsSold: eodIncludeProductsSold,
        reportKind: 'eod',
      });
      const names =
        targets.length > 0
          ? targets.map((x) => x.name)
          : [localStorage.getItem('manupos_webpos_printer') || ''];
      const named = names.map((n) => (n || '').trim()).filter(Boolean);
      if (named.length > 0 && named.every((n) => isUnsuitableRawPrinter(n))) {
        browserPrintText(text);
        toast(t('webPosEodBrowserFallback'));
        return;
      }
      const ok = await isPrintAgentAvailable();
      if (!ok) {
        browserPrintText(text);
        toast(t('webPosEodBrowserFallback'));
        return;
      }
      const logoUrl = printSettings?.receiptLogoUrl || shopLogoUrl;
      const logo = logoUrl
        ? await logoUrlToEscPos(logoUrl, paperWidthMm === 58 ? 240 : 384)
        : null;
      // Plain ESC/POS body (no bold) � kitchen tickets use bold separately.
      const escpos = textToEscPos(text, undefined, logo);
      const dataBase64 = uint8ToBase64(escpos);
      for (const name of names) {
        const label = (name || '').trim();
        if (label && isUnsuitableRawPrinter(label)) {
          throw new Error(unsuitableRawPrinterMessage(label));
        }
        try {
          await printViaAgent({ printerName: label || undefined, dataBase64, text });
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (/OneNote|PDF|XPS|ESC-POS|virtual|receipt\/ESC-POS|corrupted/i.test(msg)) {
            browserPrintText(text);
            toast(t('webPosEodBrowserFallback'));
            return;
          }
          throw err;
        }
      }
      toast.success(t('reportsPrinted'));
    } catch (e: any) {
      toastPrintError(e, t, 'webPosPrintFailed');
    }
  };

  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: t('reportsToday') },
    { id: 'yesterday', label: t('reportsYesterday') },
    { id: 'last_week', label: t('reportsLastWeek') },
    { id: 'this_month', label: t('reportsThisMonth') },
    { id: 'last_month', label: t('reportsLastMonth') },
    { id: 'last_3_months', label: t('reportsLast3Months') },
    { id: 'custom', label: t('reportsCustom') },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'eod', label: t('reportsTabEod') },
    { id: 'sales', label: t('reportsTabSales') },
    { id: 'products', label: t('reportsTabProducts') },
    ...(ownOnly ? [] : [{ id: 'users' as const, label: t('reportsTabUsers') }]),
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('reports')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('reportsHint')}</p>
          {ownOnly ? (
            <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('reportsOwnSalesOnly').replace(
                '{name}',
                report?.salesScope?.staffName || ''
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <EodIncludeProductsCheckbox
            checked={eodIncludeProductsSold}
            onChange={setEodIncludeProductsSold}
          />
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => void printEod()}
            disabled={!report || loading}
          >
            <Printer size={16} />
            {t('reportsPrintEod')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              tab === tb.id
                ? 'bg-[var(--bg-elevated)] border-[var(--border)] shadow-sm font-medium'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              preset === p.id
                ? 'bg-[var(--bg-elevated)] border-[var(--border)] shadow-sm font-medium'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsFrom')}</span>
            <input
              type="date"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsTo')}</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={() => void load()}>
            {t('reportsApply')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : !report ? (
        <p className="text-sm muted">{t('reportsEmpty')}</p>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)]">{report.range.label}</p>

          {(tab === 'eod' || tab === 'sales') && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  [t('reportsSalesCount'), String(report.salesCount)],
                  [t('reportsNetSalesExclTips'), money(report.revenue)],
                  [t('reportsTax'), money(report.taxTotal)],
                  [t('reportsNet'), money(report.netTotal ?? report.revenue - report.taxTotal)],
                  [t('reportsTips'), money(report.tipsTotal)],
                  [t('reportsGrandTotal'), money(report.grandTotal)],
                  [t('reportsCash'), money(report.cashTotal)],
                  [t('reportsCard'), money(report.cardTotal)],
                  [t('reportsTerminal'), money(report.terminalTotal)],
                  [t('reportsRefunds'), money(report.refundTotal)],
                  [t('reportsCancelled'), String(report.cancelledCount)],
                  [t('reportsCancelledTotal'), money(report.cancelledTotal)],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                  >
                    <p className="text-[11px] uppercase tracking-wide muted">{label}</p>
                    <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">{t('reportsNetSalesHint')}</p>

              {!!report.cancelledOrders?.length && (
                <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                    {t('reportsCancelled')}
                  </h2>
                  <ul className="divide-y divide-[var(--border)]">
                    {report.cancelledOrders.map((c, idx) => (
                      <li
                        key={`${c.orderNumber}-${idx}`}
                        className="px-3 py-2.5 flex flex-wrap items-start justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{c.orderNumber}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {c.cancelReason || '—'}
                            {c.cancelledAt
                              ? ` · ${formatDateTime(c.cancelledAt)}`
                              : ''}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums shrink-0">{money(c.total)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!!report.refundedOrders?.length && (
                <section className="rounded-xl border border-rose-200/80 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/20 overflow-hidden">
                  <h2 className="px-3 py-2 text-sm font-semibold bg-rose-100/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100">
                    {t('reportsRefundSummary')}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 border-b border-rose-200/60 dark:border-rose-900/40">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-rose-800/70">{t('reportsRefundCount')}</p>
                      <p className="text-lg font-semibold tabular-nums">{report.refundedOrders.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-rose-800/70">{t('reportsRefunds')}</p>
                      <p className="text-lg font-semibold tabular-nums text-rose-700">−{money(report.refundTotal)}</p>
                    </div>
                  </div>
                  {!!report.refundRows?.length && (
                    <div className="px-3 py-2 border-b border-rose-200/60 dark:border-rose-900/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-800/80 mb-1.5">
                        {t('reportsRefundsByPayment')}
                      </p>
                      <ul className="space-y-1 text-sm">
                        {report.refundRows.map((row) => (
                          <li key={row.method} className="flex justify-between gap-2">
                            <span>{paymentMethodLabel(row.method, t)}</span>
                            <span className="font-semibold tabular-nums text-rose-700">−{money(row.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-800/80">
                    {t('reportsRefundedOrders')}
                  </h3>
                  <ul className="divide-y divide-rose-200/60 dark:divide-rose-900/40">
                    {report.refundedOrders.map((r, idx) => (
                      <li
                        key={`${r.orderNumber}-rf-${idx}`}
                        className="px-3 py-2.5 flex flex-wrap items-start justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{r.orderNumber}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {t('reportsRefundReason')}: {r.refundReason || '—'}
                            {r.refundedAt
                              ? ` · ${formatDateTime(r.refundedAt)}`
                              : ''}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums shrink-0 text-rose-700">
                          −{money(r.refundAmount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!!report.shiftCash?.length && (
                <CashDrawerBreakdown shifts={report.shiftCash} money={money} />
              )}

              {!!report.vatRows?.length && (
                <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                    {t('reportsVat')}
                  </h2>
                  <div className="table-scroll">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                          <th className="px-3 py-2 font-medium">{t('reportsVatType')}</th>
                          <th className="px-3 py-2 font-medium text-right">{t('reportsVatNet')}</th>
                          <th className="px-3 py-2 font-medium text-right">{t('reportsTax')}</th>
                          <th className="px-3 py-2 font-medium text-right">{t('reportsVatBrut')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.vatRows.map((row) => (
                          <tr key={row.label} className="border-b border-[var(--border)]/60">
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2 tabular-nums text-right">{money(row.net)}</td>
                            <td className="px-3 py-2 tabular-nums text-right">{money(row.tva)}</td>
                            <td className="px-3 py-2 tabular-nums text-right">{money(row.brut)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                    {t('reportsByChannel')}
                  </h2>
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {report.channelRows.length === 0 ? (
                      <li className="px-3 py-3 muted">{t('reportsEmpty')}</li>
                    ) : (
                      report.channelRows.map((r) => (
                        <li key={r.channel} className="flex justify-between px-3 py-2">
                          <span>
                            {r.channel} � {r.count}
                          </span>
                          <span className="tabular-nums">{money(r.total)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
                <section className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                    {t('reportsByPayment')}
                  </h2>
                  <ul className="divide-y divide-[var(--border)] text-sm">
                    {report.paymentRows.length === 0 ? (
                      <li className="px-3 py-3 muted">{t('reportsEmpty')}</li>
                    ) : (
                      report.paymentRows.map((r) => (
                        <li key={r.method} className="flex justify-between px-3 py-2">
                          <span>
                            {paymentMethodLabel(r.method, t)} · {r.count}
                          </span>
                          <span className="tabular-nums">{money(r.total)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              </div>
            </>
          )}

          {(tab === 'eod' || tab === 'products') && (
            <section className="rounded-xl border border-[var(--border)] overflow-hidden">
              <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                {t('reportsProductsSold')}
              </h2>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-3 py-2 font-medium">{t('reportsProduct')}</th>
                      <th className="px-3 py-2 font-medium">{t('reportsQty')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('reportsRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.productsSold.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 muted">
                          {t('reportsEmpty')}
                        </td>
                      </tr>
                    ) : (
                      report.productsSold.map((p) => (
                        <tr key={p.name} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 tabular-nums">{p.quantity}</td>
                          <td className="px-3 py-2 tabular-nums text-right">{money(p.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'users' && (
            <section className="rounded-xl border border-[var(--border)] overflow-hidden">
              <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                {t('reportsTabUsers')}
              </h2>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-3 py-2 font-medium">{t('reportsStaff')}</th>
                      <th className="px-3 py-2 font-medium">{t('reportsSalesCount')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('reportsRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!report.userPerformance?.length ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 muted">
                          {t('reportsEmpty')}
                        </td>
                      </tr>
                    ) : (
                      report.userPerformance.map((u) => (
                        <tr key={u.name} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-2">{u.name}</td>
                          <td className="px-3 py-2 tabular-nums">{u.salesCount}</td>
                          <td className="px-3 py-2 tabular-nums text-right">{money(u.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
