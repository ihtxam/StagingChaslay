import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import {
  CashDrawerBreakdown,
  type CashDrawerShift,
} from '@/components/reports/CashDrawerBreakdown';

type Preset = 'today' | 'yesterday' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'custom';

type OverviewData = {
  range: { label: string; from: string; to: string; preset: string };
  kpis: {
    totalSales: number;
    netSales: number;
    fundingAmount: number;
    orders: number;
    customers: number;
    tipsTotal: number;
    taxTotal: number;
    changes: {
      totalSales: number;
      netSales: number;
      fundingAmount: number;
      orders: number;
      customers: number;
    };
    previousLabel: string;
  };
  salesBreakdown: { productAmount: number; tax: number; totalSales: number };
  salesOverTime: Array<{ label: string; amount: number }>;
  salesByHour?: Array<{ label: string; amount: number }>;
  paymentMethods: Array<{
    method: string;
    label: string;
    total: number;
    count: number;
    percent: number;
  }>;
  orderTypes: Array<{
    channel: string;
    label: string;
    total: number;
    count: number;
    percent: number;
  }>;
  products: Array<{ name: string; quantity: number; total: number }>;
  staff: Array<{ name: string; salesCount: number; total: number }>;
  businessName: string;
  eod?: Record<string, unknown>;
};

const CHART_COLORS = ['#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#64748b'];

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function ChangeLine({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={`mt-1.5 text-xs inline-flex items-center gap-1 ${
        up ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(0)}% {label}
    </p>
  );
}

type InsightsPreset = 'today' | 'yesterday' | 'last_week';

export default function Overview() {
  const { t } = useI18n();
  const [preset, setPreset] = useState<Preset>('today');
  const [insightsPreset, setInsightsPreset] = useState<InsightsPreset>('today');
  const [insightsData, setInsightsData] = useState<OverviewData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return params;
  }, [preset, from, to]);

  const paymentMethods = useMemo(
    () =>
      (data?.paymentMethods || []).map((p) => ({
        ...p,
        label: paymentMethodLabel(p.method, t),
      })),
    [data?.paymentMethods, t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ovRes = await api.get(`/merchant/reports/overview?${queryParams}`);
      setData(ovRes.data.overview);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await api.get(`/merchant/reports/overview?preset=${insightsPreset}`);
      setInsightsData(res.data.overview);
    } catch {
      setInsightsData(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [insightsPreset]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const busiestHour = useMemo(() => {
    const rows = insightsData?.salesByHour || [];
    if (!rows.length) return null;
    let best = rows[0]!;
    for (const r of rows) {
      if (r.amount > best.amount) best = r;
    }
    return best.amount > 0 ? best : null;
  }, [insightsData?.salesByHour]);

  const insightsHourChart = useMemo(() => {
    const rows = insightsData?.salesByHour || [];
    return rows.filter((_, i) => i % 3 === 0);
  }, [insightsData?.salesByHour]);

  const compareLabel =
    preset === 'today'
      ? t('ovThanYesterday')
      : preset === 'yesterday'
        ? t('ovThanPrevDay')
        : t('ovThanPrevPeriod');

  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: t('reportsToday') },
    { id: 'yesterday', label: t('reportsYesterday') },
    { id: 'last_week', label: t('reportsLastWeek') },
    { id: 'this_month', label: t('reportsThisMonth') },
    { id: 'last_month', label: t('reportsLastMonth') },
    { id: 'last_3_months', label: t('reportsLast3Months') },
    { id: 'custom', label: t('reportsCustom') },
  ];

  if (loading && !data) {
    return <div className="text-center py-10 muted text-sm">{t('loading')}</div>;
  }

  const kpis = data?.kpis;
  const maxProduct = Math.max(...(data?.products || []).map((p) => p.total), 1);
  const maxStaff = Math.max(...(data?.staff || []).map((s) => s.total), 1);
  const shiftCash = Array.isArray((data?.eod as { shiftCash?: CashDrawerShift[] } | undefined)?.shiftCash)
    ? ((data?.eod as { shiftCash?: CashDrawerShift[] }).shiftCash as CashDrawerShift[])
    : [];

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t('overview')}</h1>
          <p className="page-sub">{t('overviewSub')}</p>
        </div>
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
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('ovInsights')}</h2>
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-muted)]">
            {(
              [
                ['today', t('reportsToday')],
                ['yesterday', t('reportsYesterday')],
                ['last_week', t('ovThisWeek')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setInsightsPreset(id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  insightsPreset === id
                    ? 'bg-[var(--bg-elevated)] shadow-sm font-medium'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card min-h-[280px]">
            <h3 className="text-sm font-semibold">{t('ovBestSelling')}</h3>
            <p className="text-xs muted mb-3">{t('ovBestSellingHint')}</p>
            {insightsLoading ? (
              <p className="text-sm muted">{t('loading')}</p>
            ) : (insightsData?.products || []).length ? (
              <div className="space-y-2">
                {(insightsData?.products || []).slice(0, 8).map((p) => {
                  const max = Math.max(...(insightsData?.products || []).map((x) => x.quantity), 1);
                  return (
                    <div key={p.name} className="text-sm">
                      <div className="flex justify-between gap-2 mb-0.5">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums muted shrink-0">{p.quantity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-500/80"
                          style={{ width: `${Math.max(4, (p.quantity / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm muted text-center py-10">{t('ovNoItemsSold')}</p>
            )}
          </div>

          <div className="card min-h-[280px]">
            <h3 className="text-sm font-semibold">{t('ovBusiestPeriod')}</h3>
            <p className="text-xs muted mb-3">{t('ovBusiestPeriodHint')}</p>
            <div className="h-[200px]">
              {insightsLoading ? (
                <p className="text-sm muted">{t('loading')}</p>
              ) : (insightsData?.salesByHour || []).some((h) => h.amount > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insightsHourChart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="amount" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm muted text-center py-10">{t('ovNoSalesYet')}</p>
              )}
            </div>
            <div className="flex justify-between text-xs muted mt-2 pt-2 border-t border-[var(--border)]">
              <span>{t('ovBusiestHour')}</span>
              <span>
                {t('ovBusiestTime')}
                {busiestHour ? `: ${busiestHour.label}:00` : ' —'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {[
            { key: 'totalSales', label: t('ovTotalSales'), value: money(kpis.totalSales), change: kpis.changes.totalSales },
            { key: 'netSales', label: t('ovNetSales'), value: money(kpis.netSales), change: kpis.changes.netSales },
            { key: 'tips', label: t('ovTips'), value: money(kpis.tipsTotal), change: null as number | null },
            { key: 'funding', label: t('ovFunding'), value: money(kpis.fundingAmount), change: kpis.changes.fundingAmount },
            { key: 'orders', label: t('ovOrders'), value: String(kpis.orders), change: kpis.changes.orders },
            { key: 'customers', label: t('ovCustomers'), value: String(kpis.customers), change: kpis.changes.customers },
          ].map((card) => (
            <div key={card.key} className="card">
              <p className="text-xs muted">{card.label}</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{card.value}</p>
              <ChangeLine value={card.change} label={compareLabel} />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="card xl:col-span-2 min-h-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovSalesOverTime')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.salesOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="amount" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold mb-3">{t('ovSalesBreakdown')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="muted">{t('ovProductAmount')}</span>
              <span className="font-medium tabular-nums">{money(data?.salesBreakdown.productAmount || 0)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="muted">{t('ovTax')}</span>
              <span className="font-medium tabular-nums">{money(data?.salesBreakdown.tax || 0)}</span>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-[var(--border)] font-semibold">
              <span>{t('ovTotalSales')}</span>
              <span className="tabular-nums">{money(data?.salesBreakdown.totalSales || 0)}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>{t('ovTips')}</span>
              <span className="tabular-nums">{money(data?.kpis.tipsTotal || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card min-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovByPayment')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-sm space-y-1.5 w-full sm:w-1/2">
              {paymentMethods.map((p, i) => (
                <li key={p.method} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{p.label}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {money(p.total)} ({p.percent}%)
                  </span>
                </li>
              ))}
              {!paymentMethods.length && <li className="muted">{t('reportsEmpty')}</li>}
            </ul>
          </div>
        </div>

        <div className="card min-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovByOrderType')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.orderTypes || []}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {(data?.orderTypes || []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-sm space-y-1.5 w-full sm:w-1/2">
              {(data?.orderTypes || []).map((o, i) => (
                <li key={o.channel} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[(i + 2) % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {money(o.total)} ({o.percent}%)
                  </span>
                </li>
              ))}
              {!data?.orderTypes?.length && <li className="muted">{t('reportsEmpty')}</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t('ovByProducts')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.products || []).slice(0, 8).map((p) => (
              <div key={p.name} className="text-sm">
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums muted shrink-0">
                    {p.quantity} · {money(p.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-fuchsia-500/80"
                    style={{ width: `${Math.max(4, (p.total / maxProduct) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!data?.products?.length && <p className="text-sm muted">{t('reportsEmpty')}</p>}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t('ovByStaff')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="h-[220px]">
            {(data?.staff || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.staff || []} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="total" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm muted">{t('reportsEmpty')}</p>
            )}
          </div>
          {!data?.staff?.length ? null : (
            <ul className="mt-2 text-xs muted space-y-1">
              {(data?.staff || []).map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="tabular-nums">
                    {money(s.total)} ({Math.round((s.total / maxStaff) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {shiftCash.length > 0 && <CashDrawerBreakdown shifts={shiftCash} money={money} />}

      <div className="card">
        <h2 className="text-sm font-semibold mb-3">{t('ovCommonOps')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-rose-600 mb-2">{t('ovOrderReports')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { to: '/merchant/reports', label: t('ovLinkOrderTypes') },
                { to: '/merchant/reports', label: t('ovLinkTax') },
                { to: '/merchant/reports', label: t('ovLinkProducts') },
                { to: '/merchant/orders', label: t('orders') },
              ].map((link) => (
                <Link key={link.label} to={link.to} className="btn-secondary text-xs py-1.5">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-600 mb-2">{t('ovFinancialReports')}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/merchant/reports" className="btn-secondary text-xs py-1.5">
                {t('ovLinkTender')}
              </Link>
              <Link to="/merchant/reports" className="btn-secondary text-xs py-1.5">
                {t('ovLinkCashDrawer')}
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
