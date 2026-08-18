import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

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
