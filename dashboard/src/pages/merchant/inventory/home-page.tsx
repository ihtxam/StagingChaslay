import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Package, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type DashboardData = {
  hasDemoData: boolean;
  hasAnyData: boolean;
  kpis: {
    stockValue: number;
    itemCount: number;
    lowStockCount: number;
    belowReorderCount: number;
    recipesLinkedCount: number;
    recipesTotalProducts: number;
    recipesLinkedPct: number;
    wastePct: number;
    stockInThisWeek: number;
    movementsThisWeek: number;
    turnoverRatio: number;
  };
  scenarios: Array<{ id: string; tone: 'warning' | 'success' | 'info'; params?: Record<string, string | number> }>;
  stockInByDay: Array<{ date: string; qty: number; cost: number }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    onHand: number;
    minStock: number;
    reorderQty: number;
    unit: string;
  }>;
  recipeExamples: Array<{
    productId: string;
    productName: string;
    recipeYield: number;
    exampleLabel: string;
    autoConsumption: boolean;
    lines: Array<{ itemName: string; qty: number; unit: string }>;
  }>;
};

function scenarioText(
  t: (key: string, params?: Record<string, string | number>) => string,
  scenario: DashboardData['scenarios'][0]
): string {
  const p = scenario.params || {};
  switch (scenario.id) {
    case 'chicken_reorder':
      return t('invDemoScenarioChickenReorder', {
        name: String(p.name || ''),
        onHand: Number(p.onHand ?? 0),
        unit: String(p.unit || ''),
      });
    case 'margherita_linked':
      return t('invDemoScenarioMargheritaLinked');
    case 'stock_in_week':
      return t('invDemoScenarioStockInWeek', { count: Number(p.count ?? 0) });
    case 'demo_active':
      return t('invDemoScenarioActive');
    default:
      return scenario.id;
  }
}

function toneClass(tone: string): string {
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  return 'border-sky-200 bg-sky-50 text-sky-950';
}

export function InventoryHomePage() {
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/inventory/dashboard');
      setDashboard(res.data.dashboard || null);
    } catch {
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onImportDemo = async () => {
    if (!confirm(t('invImportDemoConfirm'))) return;
    setImporting(true);
    try {
      const res = await api.post('/merchant/inventory/import-demo');
      toast.success(
        t('invImportDemoSuccess', {
          items: res.data.itemsCreated ?? 0,
          recipes: res.data.recipesCreated ?? 0,
        })
      );
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invImportDemoFailed'));
    } finally {
      setImporting(false);
    }
  };

  const onDeleteDemo = async () => {
    if (!confirm(t('invDeleteDemoConfirm'))) return;
    setDeleting(true);
    try {
      await api.delete('/merchant/inventory/demo-data');
      toast.success(t('invDeleteDemoSuccess'));
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invDeleteDemoFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm muted">{t('loading')}</div>;
  }

  const empty = !dashboard?.hasAnyData;
  const maxChartQty = Math.max(1, ...(dashboard?.stockInByDay.map((d) => d.qty) || [1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs muted max-w-xl">{t('invDashboardHint')}</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn-secondary"
            disabled={importing || deleting}
            onClick={() => void onImportDemo()}
          >
            <Sparkles size={14} />
            {importing ? t('invImportDemoLoading') : t('invImportDemo')}
          </button>
          {dashboard?.hasDemoData ? (
            <button
              type="button"
              className="btn-secondary text-red-700"
              disabled={importing || deleting}
              onClick={() => void onDeleteDemo()}
            >
              <Trash2 size={14} />
              {deleting ? t('invDeleteDemoLoading') : t('invDeleteDemo')}
            </button>
          ) : null}
        </div>
      </div>

      {empty ? (
        <div className="card space-y-3 text-center py-10">
          <Package className="mx-auto text-[var(--muted)]" size={32} />
          <p className="text-sm font-medium">{t('invDashboardEmptyTitle')}</p>
          <p className="text-xs muted max-w-md mx-auto">{t('invDashboardEmptyHint')}</p>
          <button type="button" className="btn-primary mx-auto" disabled={importing} onClick={() => void onImportDemo()}>
            <Sparkles size={14} />
            {importing ? t('invImportDemoLoading') : t('invImportDemo')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t('invKpiStockValue'), value: dashboard!.kpis.stockValue.toFixed(2), sub: t('invKpiStockValueSub') },
              { label: t('invKpiLowStock'), value: String(dashboard!.kpis.lowStockCount), sub: t('invKpiLowStockSub') },
              { label: t('invKpiRecipesLinked'), value: `${dashboard!.kpis.recipesLinkedPct}%`, sub: t('invKpiRecipesLinkedSub', { linked: dashboard!.kpis.recipesLinkedCount, total: dashboard!.kpis.recipesTotalProducts }) },
              { label: t('invKpiTurnover'), value: String(dashboard!.kpis.turnoverRatio), sub: t('invKpiTurnoverSub', { waste: dashboard!.kpis.wastePct }) },
            ].map((kpi) => (
              <div key={kpi.label} className="card space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide muted">{kpi.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
                <p className="text-[11px] muted">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                <h2 className="text-sm font-semibold">{t('invDashboardScenarios')}</h2>
              </div>
              {dashboard!.scenarios.length === 0 ? (
                <p className="text-xs muted">{t('invDashboardNoScenarios')}</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard!.scenarios.map((s) => (
                    <li
                      key={s.id}
                      className={`rounded-lg border px-3 py-2 text-xs ${toneClass(s.tone)}`}
                    >
                      {scenarioText(t, s)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card space-y-3">
              <h2 className="text-sm font-semibold">{t('invDashboardStockInWeek')}</h2>
              {dashboard!.stockInByDay.length === 0 ? (
                <p className="text-xs muted">{t('invNoHistory')}</p>
              ) : (
                <div className="space-y-2">
                  {dashboard!.stockInByDay.map((row) => (
                    <div key={row.date} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span>{row.date}</span>
                        <span className="tabular-nums">
                          {row.qty.toFixed(1)} · {row.cost.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${Math.max(8, (row.qty / maxChartQty) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] muted">
                {t('invDashboardMovementsWeek', { count: dashboard!.kpis.movementsThisWeek })}
              </p>
            </div>
          </div>

          {dashboard!.lowStockItems.length > 0 && (
            <div className="card !p-0 table-scroll">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                <AlertTriangle size={14} className="text-amber-600" />
                <h2 className="text-sm font-semibold">{t('invDashboardLowStock')}</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-muted)] text-left">
                  <tr>
                    <th className="px-3 py-2">{t('invItemName')}</th>
                    <th className="px-3 py-2">{t('invOnHand')}</th>
                    <th className="px-3 py-2">{t('invParLevel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard!.lowStockItems.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 tabular-nums text-amber-800">
                        {item.onHand} {item.unit}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {item.minStock} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dashboard!.recipeExamples.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} />
                  <h2 className="text-sm font-semibold">{t('invDashboardRecipeExamples')}</h2>
                </div>
                <Link to="/merchant/inventory/cookbook" className="text-xs text-teal-700 hover:underline">
                  {t('invNavCookbook')} →
                </Link>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {dashboard!.recipeExamples.map((ex) => (
                  <div
                    key={ex.productId}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 space-y-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">{ex.productName}</p>
                      <p className="text-[11px] muted">{ex.exampleLabel}</p>
                    </div>
                    <p className="text-[11px]">
                      {t('invRecipeYield')}: <span className="font-medium tabular-nums">{ex.recipeYield}</span>
                      {ex.autoConsumption ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                          {t('invDemoAutoConsumption')}
                        </span>
                      ) : null}
                    </p>
                    <ul className="text-[11px] space-y-0.5">
                      {ex.lines.map((line, idx) => (
                        <li key={idx} className="tabular-nums">
                          · {line.qty} {line.unit} {line.itemName}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
