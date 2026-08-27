import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type DeadRow = {
  id: string;
  kind: 'inventory' | 'product';
  name: string;
  unit?: string;
  sku?: string | null;
  onHand: number;
  soldQty: number;
  purchasedQty: number;
  stockValue: number;
  daysSinceSale: number | null;
  daysOfStock: number | null;
  velocityPerDay: number;
  tier: 'dead' | 'slow' | 'healthy';
  recommendation: 'stop_ordering' | 'review' | 'ok';
  doNotReorder: boolean;
  autoReorderEnabled: boolean;
  supplierName?: string | null;
  revenue?: number;
};

type DeadReport = {
  days: number;
  summary: {
    deadInventoryCount: number;
    slowInventoryCount: number;
    deadProductCount: number;
    stopOrderingCount: number;
    stockValueDead: number;
    autoReorderOnDead: number;
  };
  inventoryItems: DeadRow[];
  products: DeadRow[];
};

function tierBadge(tier: DeadRow['tier'], t: (k: string) => string) {
  if (tier === 'dead') return 'bg-red-100 text-red-800';
  if (tier === 'slow') return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-800';
}

function tierLabel(tier: DeadRow['tier'], t: (k: string) => string) {
  if (tier === 'dead') return t('invDeadTierDead');
  if (tier === 'slow') return t('invDeadTierSlow');
  return t('invDeadTierHealthy');
}

function recommendationLabel(rec: DeadRow['recommendation'], t: (k: string) => string) {
  if (rec === 'stop_ordering') return t('invDeadRecStop');
  if (rec === 'review') return t('invDeadRecReview');
  return t('invDeadRecOk');
}

function DeadStockTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  onStopOne,
  showSupplier,
  t,
}: {
  rows: DeadRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onStopOne: (id: string) => void;
  showSupplier: boolean;
  t: (k: string) => string;
}) {
  const selectable = rows.filter((r) => r.kind === 'inventory' && !r.doNotReorder);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  return (
    <div className="card !p-0 table-scroll">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-[var(--bg-muted)] text-left">
          <tr>
            {showSupplier ? (
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    onToggleAll(allSelected ? [] : selectable.map((r) => r.id))
                  }
                  aria-label={t('selectAll')}
                />
              </th>
            ) : (
              <th className="px-3 py-2 w-8" />
            )}
            <th className="px-3 py-2">{t('invItemName')}</th>
            <th className="px-3 py-2">{t('invOnHand')}</th>
            <th className="px-3 py-2">{t('invDeadSold')}</th>
            <th className="px-3 py-2">{t('invDeadPurchased')}</th>
            <th className="px-3 py-2">{t('invDeadDaysSinceSale')}</th>
            <th className="px-3 py-2">{t('invDeadStockValue')}</th>
            <th className="px-3 py-2">{t('invDeadTier')}</th>
            <th className="px-3 py-2">{t('invDeadRecommendation')}</th>
            {showSupplier ? <th className="px-3 py-2">{t('invSupplier')}</th> : null}
            {showSupplier ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">
                {row.kind === 'inventory' && !row.doNotReorder ? (
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => onToggle(row.id)}
                  />
                ) : null}
              </td>
              <td className="px-3 py-2 font-medium">
                {row.name}
                {row.sku ? <span className="ml-1 text-xs muted">({row.sku})</span> : null}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {row.onHand}
                {row.unit ? ` ${row.unit}` : ''}
              </td>
              <td className="px-3 py-2 tabular-nums">{row.soldQty}</td>
              <td className="px-3 py-2 tabular-nums">{row.purchasedQty}</td>
              <td className="px-3 py-2 tabular-nums">
                {row.daysSinceSale == null ? '—' : row.daysSinceSale}
              </td>
              <td className="px-3 py-2 tabular-nums">{row.stockValue.toFixed(2)}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tierBadge(row.tier, t)}`}
                >
                  {tierLabel(row.tier, t)}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{recommendationLabel(row.recommendation, t)}</td>
              {showSupplier ? (
                <td className="px-3 py-2 text-xs">{row.supplierName || '—'}</td>
              ) : null}
              {showSupplier ? (
                <td className="px-3 py-2">
                  {row.kind === 'inventory' ? (
                    row.doNotReorder ? (
                      <span className="text-xs text-emerald-700">{t('invDeadStopped')}</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-medium text-red-700 hover:underline"
                        onClick={() => onStopOne(row.id)}
                      >
                        {t('invDeadStopOrdering')}
                      </button>
                    )
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={showSupplier ? 11 : 9} className="px-3 py-8 text-center muted">
                {t('invDeadNone')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DeadStockReportPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(90);
  const [filter, setFilter] = useState<'all' | 'dead' | 'slow' | 'stop'>('stop');
  const [report, setReport] = useState<DeadReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/merchant/inventory/dead-stock', { params: { days } })
      .then((res) => {
        setReport(res.data.report);
        setSelected(new Set());
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredInventory = useMemo(() => {
    const rows = report?.inventoryItems || [];
    if (filter === 'dead') return rows.filter((r) => r.tier === 'dead');
    if (filter === 'slow') return rows.filter((r) => r.tier === 'slow');
    if (filter === 'stop') return rows.filter((r) => r.recommendation === 'stop_ordering');
    return rows;
  }, [report, filter]);

  const filteredProducts = useMemo(() => {
    const rows = (report?.products || []).filter((r) => r.tier !== 'healthy');
    if (filter === 'dead') return rows.filter((r) => r.tier === 'dead');
    if (filter === 'slow') return rows.filter((r) => r.tier === 'slow');
    if (filter === 'stop') return rows.filter((r) => r.recommendation === 'stop_ordering');
    return rows;
  }, [report, filter]);

  const stopOrdering = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      await api.post('/merchant/inventory/stop-ordering', { itemIds: ids });
      toast.success(t('invDeadStopSuccess').replace('{n}', String(ids.length)));
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('invDeadStopFailed'));
    } finally {
      setBusy(false);
    }
  };

  const summary = report?.summary;

  return (
    <div className="space-y-4">
      <p className="text-sm muted">{t('invDeadHint')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-[120px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={30}>30 {t('days')}</option>
          <option value={60}>60 {t('days')}</option>
          <option value={90}>90 {t('days')}</option>
          <option value={180}>180 {t('days')}</option>
        </select>
        <select className="input max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="stop">{t('invDeadFilterStop')}</option>
          <option value="dead">{t('invDeadFilterDead')}</option>
          <option value="slow">{t('invDeadFilterSlow')}</option>
          <option value="all">{t('invDeadFilterAll')}</option>
        </select>
        {selected.size > 0 ? (
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy}
            onClick={() => void stopOrdering([...selected])}
          >
            {t('invDeadStopSelected').replace('{n}', String(selected.size))}
          </button>
        ) : null}
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t('invDeadSummaryDeadStock'), value: summary.deadInventoryCount },
            { label: t('invDeadSummarySlow'), value: summary.slowInventoryCount },
            { label: t('invDeadSummaryDeadProducts'), value: summary.deadProductCount },
            { label: t('invDeadSummaryStop'), value: summary.stopOrderingCount },
            { label: t('invDeadSummaryValue'), value: summary.stockValueDead.toFixed(0) },
            { label: t('invDeadSummaryAutoReorder'), value: summary.autoReorderOnDead },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide muted">{card.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : (
        <>
          <div>
            <h2 className="mb-2 text-sm font-bold">{t('invDeadStockItems')}</h2>
            <DeadStockTable
              rows={filteredInventory}
              selected={selected}
              onToggle={(id) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onToggleAll={(ids) => setSelected(new Set(ids))}
              onStopOne={(id) => void stopOrdering([id])}
              showSupplier
              t={t}
            />
          </div>

          {filteredProducts.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-bold">{t('invDeadPosProducts')}</h2>
              <p className="mb-2 text-xs muted">{t('invDeadPosHint')}</p>
              <DeadStockTable
                rows={filteredProducts}
                selected={selected}
                onToggle={() => undefined}
                onToggleAll={() => undefined}
                onStopOne={() => undefined}
                showSupplier={false}
                t={t}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function InventoryReportPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<{
    byStock: Array<{ name: string; qty: number; cost: number }>;
    bySupplier: Array<{ name: string; qty: number; cost: number }>;
    byDate: Array<{ date: string; qty: number; cost: number }>;
  } | null>(null);

  useEffect(() => {
    api
      .get('/merchant/inventory/purchase-report', { params: { days } })
      .then((res) => setReport(res.data.report))
      .catch(() => setReport({ byStock: [], bySupplier: [], byDate: [] }));
  }, [days]);

  const block = (title: string, rows: Array<{ name?: string; date?: string; qty: number; cost: number }>) => (
    <div className="card !p-0 table-scroll">
      <h2 className="px-3 py-2 text-sm font-semibold">{title}</h2>
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-muted)] text-left">
          <tr>
            <th className="px-3 py-2">{t('invItemName')}</th>
            <th className="px-3 py-2">{t('invQty')}</th>
            <th className="px-3 py-2">{t('invCost')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.name || r.date}-${i}`} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">{r.name || r.date}</td>
              <td className="px-3 py-2 tabular-nums">{r.qty}</td>
              <td className="px-3 py-2 tabular-nums">{r.cost.toFixed(2)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center muted">{t('invNoHistory')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <select className="input max-w-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        <option value={7}>7</option>
        <option value={30}>30</option>
        <option value={90}>90</option>
      </select>
      {block(t('invPurchaseByStock'), report?.byStock || [])}
      {block(t('invPurchaseBySupplier'), report?.bySupplier || [])}
      {block(t('invPurchaseByDate'), report?.byDate || [])}
    </div>
  );
}

export function ConsumptionReportPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Array<{
    id: string;
    name: string;
    unit: string;
    theoreticalUsage: number;
    wasteQty: number;
    onHand: number;
  }>>([]);

  useEffect(() => {
    api
      .get('/merchant/inventory/usage', { params: { days: 30 } })
      .then((res) => setRows(res.data.rows || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="card !p-0 table-scroll">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-[var(--bg-muted)] text-left">
          <tr>
            <th className="px-3 py-2">{t('invItemName')}</th>
            <th className="px-3 py-2">{t('invTheoreticalUsage')}</th>
            <th className="px-3 py-2">{t('invWaste')}</th>
            <th className="px-3 py-2">{t('invOnHand')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2 tabular-nums">{row.theoreticalUsage} {row.unit}</td>
              <td className="px-3 py-2 tabular-nums">{row.wasteQty} {row.unit}</td>
              <td className="px-3 py-2 tabular-nums">{row.onHand} {row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
