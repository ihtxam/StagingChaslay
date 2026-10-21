import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type ProfitRow = {
  id: string;
  label: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number | null;
  avgSalePrice: number | null;
  avgBuyingPrice: number | null;
  revenueChangePct?: number | null;
  profitChangePct?: number | null;
};

type ProfitReport = {
  range: { label: string; from: string; to: string };
  previousRange: { label: string };
  granularity: 'day' | 'week' | 'month';
  summary: {
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number | null;
    revenueChangePct: number | null;
    profitChangePct: number | null;
    productsWithBuyingPrice: number;
    catalogProductCount: number;
    linesMissingBuyingPrice: number;
  };
  byProduct: ProfitRow[];
  byCategory: ProfitRow[];
  byPeriod: ProfitRow[];
  catalogPricing: Array<{
    id: string;
    name: string;
    salePrice: number;
    buyingPrice: number | null;
    unitProfit: number;
    marginPct: number | null;
  }>;
};

type Preset = 'today' | 'yesterday' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';

type Props = {
  preset: Preset;
  from: string;
  to: string;
};

function pctBadge(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function ProfitTable({
  rows,
  money,
  showPricing,
}: {
  rows: ProfitRow[];
  money: (n: number) => string;
  showPricing?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-stone-500">—</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-stone-600">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium text-right">Qty</th>
            {showPricing ? (
              <>
                <th className="py-2 pr-3 font-medium text-right">Avg sell</th>
                <th className="py-2 pr-3 font-medium text-right">Avg buy</th>
              </>
            ) : null}
            <th className="py-2 pr-3 font-medium text-right">Revenue</th>
            <th className="py-2 pr-3 font-medium text-right">COGS</th>
            <th className="py-2 pr-3 font-medium text-right">Profit</th>
            <th className="py-2 pr-3 font-medium text-right">Margin</th>
            <th className="py-2 font-medium text-right">vs prior</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-stone-100">
              <td className="py-2 pr-3 font-medium text-stone-900">{row.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.quantity}</td>
              {showPricing ? (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.avgSalePrice != null ? money(row.avgSalePrice) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.avgBuyingPrice != null ? money(row.avgBuyingPrice) : '—'}
                  </td>
                </>
              ) : null}
              <td className="py-2 pr-3 text-right tabular-nums">{money(row.revenue)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(row.cogs)}</td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium">{money(row.profit)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {row.marginPct != null ? `${row.marginPct.toFixed(1)}%` : '—'}
              </td>
              <td
                className={`py-2 text-right tabular-nums ${
                  (row.profitChangePct ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {pctBadge(row.profitChangePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProfitMarginPanel({ preset, from, to }: Props) {
  const { t } = useI18n();
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset, granularity });
      if (preset === 'custom') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const res = await api.get(`/merchant/reports/profit-margin?${params}`);
      setReport(res.data.report as ProfitReport);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('reportsProfitLoadFailed'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [preset, from, to, granularity, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return <p className="text-sm muted py-6">{t('loading')}</p>;
  }

  if (!report) {
    return <p className="text-sm muted py-6">{t('reportsEmpty')}</p>;
  }

  const granLabel =
    granularity === 'month'
      ? t('reportsPeriodMonthly')
      : granularity === 'week'
        ? t('reportsPeriodWeekly')
        : t('reportsPeriodDaily');

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">{t('reportsProfitHint')}</p>
      {report.summary.linesMissingBuyingPrice > 0 ? (
        <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          {t('reportsProfitMissingCostHint').replace(
            '{n}',
            String(report.summary.linesMissingBuyingPrice)
          )}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs muted">{t('reportsRevenue')}</p>
          <p className="text-lg font-semibold tabular-nums">{money(report.summary.revenue)}</p>
          <p className="text-xs muted mt-1">{pctBadge(report.summary.revenueChangePct)} vs prior</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs muted">{t('reportsCogs')}</p>
          <p className="text-lg font-semibold tabular-nums">{money(report.summary.cogs)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs muted">{t('reportsProfit')}</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-800">
            {money(report.summary.profit)}
          </p>
          <p className="text-xs muted mt-1">{pctBadge(report.summary.profitChangePct)} vs prior</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs muted">{t('reportsMargin')}</p>
          <p className="text-lg font-semibold tabular-nums">
            {report.summary.marginPct != null ? `${report.summary.marginPct.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs muted mt-1">
            {report.summary.productsWithBuyingPrice}/{report.summary.catalogProductCount}{' '}
            {t('productBuyingPrice').toLowerCase()}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm muted">{t('reportsProfitPeriod')}:</span>
        {(['day', 'week', 'month'] as const).map((g) => (
          <button
            key={g}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              granularity === g
                ? 'bg-[var(--bg-elevated)] border-[var(--border)] font-medium'
                : 'border-transparent text-[var(--text-muted)]'
            }`}
            onClick={() => setGranularity(g)}
          >
            {g === 'month'
              ? t('reportsPeriodMonthly')
              : g === 'week'
                ? t('reportsPeriodWeekly')
                : t('reportsPeriodDaily')}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[var(--border)] overflow-hidden">
        <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
          {granLabel} · {report.range.label}
        </h2>
        <div className="p-3">
          <ProfitTable rows={report.byPeriod} money={money} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] overflow-hidden">
        <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
          {t('reportsProfitByCategory')}
        </h2>
        <div className="p-3">
          <ProfitTable rows={report.byCategory.slice(0, 40)} money={money} showPricing />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] overflow-hidden">
        <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
          {t('reportsProfitByProduct')}
        </h2>
        <div className="p-3">
          <ProfitTable rows={report.byProduct.slice(0, 50)} money={money} showPricing />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] overflow-hidden">
        <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
          {t('reportsCatalogPricingCompare')}
        </h2>
        <div className="p-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-2 pr-2">{t('reportsProduct')}</th>
                <th className="py-2 pr-2 text-right">{t('reportsSalePrice')}</th>
                <th className="py-2 pr-2 text-right">{t('productBuyingPrice')}</th>
                <th className="py-2 pr-2 text-right">{t('reportsProfit')}</th>
                <th className="py-2 text-right">{t('reportsMargin')}</th>
              </tr>
            </thead>
            <tbody>
              {report.catalogPricing.slice(0, 30).map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-2">{p.name}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{money(p.salePrice)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {p.buyingPrice != null ? money(p.buyingPrice) : '—'}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{money(p.unitProfit)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {p.marginPct != null ? `${p.marginPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
