import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type MixRow = {
  id: string;
  label: string;
  quantity: number;
  revenue: number;
  revenueSharePct: number;
  quantitySharePct: number;
  previousRevenue?: number;
  revenueChangePct?: number | null;
};

type SalesMixReport = {
  range: { label: string; from: string; to: string };
  previousRange: { from: string; to: string; label: string };
  summary: {
    orderCount: number;
    revenue: number;
    averageOrderValue: number;
    revenueChangePct: number | null;
    orderCountChangePct: number | null;
  };
  categoryMix: MixRow[];
  productMix: MixRow[];
  channelMix: MixRow[];
  orderSourceMix: MixRow[];
  paymentMix: MixRow[];
  daypartMix: MixRow[];
};

type Preset = 'today' | 'yesterday' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';

type Props = {
  preset: Preset;
  from: string;
  to: string;
  licensed: boolean;
};

function pctBadge(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function MixTable({ rows, money }: { rows: MixRow[]; money: (n: number) => string }) {
  if (!rows.length) {
    return <p className="text-sm text-stone-500">No data for this period.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-stone-600">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium text-right">Qty</th>
            <th className="py-2 pr-3 font-medium text-right">Revenue</th>
            <th className="py-2 pr-3 font-medium text-right">Mix %</th>
            <th className="py-2 font-medium text-right">vs prior</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-stone-100">
              <td className="py-2 pr-3 font-medium text-stone-900">{row.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.quantity}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{money(row.revenue)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.revenueSharePct.toFixed(1)}%</td>
              <td
                className={`py-2 text-right tabular-nums ${
                  (row.revenueChangePct ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {pctBadge(row.revenueChangePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesMixPanel({ preset, from, to, licensed }: Props) {
  const { t } = useI18n();
  const [report, setReport] = useState<SalesMixReport | null>(null);
  const [loading, setLoading] = useState(false);

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const load = useCallback(async () => {
    if (!licensed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === 'custom') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const res = await api.get(`/merchant/reports/sales-mix?${params}`);
      setReport(res.data.report as SalesMixReport);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } };
      if (err.response?.data?.code === 'GROWTH_ANALYTICS_ADDON') {
        setReport(null);
      } else {
        toast.error(err.response?.data?.error || t('reportsLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [preset, from, to, licensed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!licensed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
        <p className="font-semibold">Sales mix & analytics add-on</p>
        <p className="mt-2 text-amber-900/90">
          Category and product mix, daypart, channel, and payment analytics are available as a paid
          add-on (CHF 28/month). Ask your reseller or Reborn admin to enable{' '}
          <strong>Growth Analytics</strong> for your account.
        </p>
      </div>
    );
  }

  if (loading && !report) {
    return <p className="text-sm text-stone-500">{t('loading')}</p>;
  }

  if (!report) {
    return <p className="text-sm text-stone-500">{t('reportsLoadFailed')}</p>;
  }

  const s = report.summary;

  return (
    <div className="space-y-8">
      <p className="text-xs text-stone-500">
        {report.range.label} · compared to {report.previousRange.label}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Net sales</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(s.revenue)}</p>
          <p className="mt-1 text-xs text-stone-600">{pctBadge(s.revenueChangePct)} vs prior</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Orders</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{s.orderCount}</p>
          <p className="mt-1 text-xs text-stone-600">{pctBadge(s.orderCountChangePct)} vs prior</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Avg. order</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(s.averageOrderValue)}</p>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-base font-semibold text-stone-900">Category mix</h3>
        <MixTable rows={report.categoryMix} money={money} />
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-stone-900">Top products</h3>
        <MixTable rows={report.productMix} money={money} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-base font-semibold text-stone-900">Channel mix</h3>
          <MixTable rows={report.channelMix} money={money} />
        </section>
        <section>
          <h3 className="mb-3 text-base font-semibold text-stone-900">Order source</h3>
          <MixTable rows={report.orderSourceMix} money={money} />
        </section>
        <section>
          <h3 className="mb-3 text-base font-semibold text-stone-900">Payment mix</h3>
          <MixTable rows={report.paymentMix} money={money} />
        </section>
        <section>
          <h3 className="mb-3 text-base font-semibold text-stone-900">Daypart</h3>
          <MixTable rows={report.daypartMix} money={money} />
        </section>
      </div>
    </div>
  );
}
