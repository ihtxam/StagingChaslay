import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { loadItems, loadSuppliers, loadUnits, type InvItem, type InvUnit } from './shared';

function useItems() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [units, setUnits] = useState<InvUnit[]>([]);
  const reload = async () => {
    const [i, u] = await Promise.all([loadItems(), loadUnits().catch(() => ({ units: [], ratios: [] }))]);
    setItems(i);
    setUnits(u.units);
  };
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);
  return { items, units, reload };
}

export function InventoryListPage() {
  const { t } = useI18n();
  const { items } = useItems();
  return (
    <div className="card !p-0 table-scroll">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-[var(--bg-muted)] text-left">
          <tr>
            <th className="px-3 py-2">{t('invItemName')}</th>
            <th className="px-3 py-2">{t('invNavCategories')}</th>
            <th className="px-3 py-2">{t('invOnHand')}</th>
            <th className="px-3 py-2">{t('invParLevel')}</th>
            <th className="px-3 py-2">{t('invPreferredSupplier')}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center muted">
                {t('invNoItems')}
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">
                <div className="font-medium">{item.name}</div>
                <div className="text-[11px] muted">{item.unit}</div>
              </td>
              <td className="px-3 py-2 text-xs">{item.category?.name || '—'}</td>
              <td className="px-3 py-2 tabular-nums">
                {item.onHand} {item.unit}
                {item.outOfStock ? (
                  <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                    {t('invOutOfStock')}
                  </span>
                ) : item.lowStock ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                    <AlertTriangle size={10} /> {t('invLowStock')}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {item.minStock} {item.unit}
              </td>
              <td className="px-3 py-2">{item.supplier?.name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InboundStockPage() {
  const { t } = useI18n();
  const { items, units, reload } = useItems();
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [supplierName, setSupplierName] = useState('');

  useEffect(() => {
    void loadSuppliers().then((rows) => setSuppliers(rows.filter((s) => !s.archivedAt)));
  }, []);

  const selected = items.find((i) => i.id === itemId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/merchant/inventory/items/${itemId}/stock-in`, {
        qty: Number(qty),
        unit: unit || undefined,
        unitCost: cost ? Number(cost) : undefined,
        note: note || undefined,
        supplierName: supplierName || undefined,
      });
      toast.success(t('invStockInSaved'));
      setQty('');
      setNote('');
      setCost('');
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  return (
    <form className="card max-w-lg space-y-3" onSubmit={(e) => void submit(e)}>
      <p className="text-xs muted">{t('invStockInHint')}</p>
      <select className="input" value={itemId} required onChange={(e) => setItemId(e.target.value)}>
        <option value="">{t('invSelectItem')}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.onHand} {i.unit})
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">{t('invQty')}</span>
          <input className="input" type="number" min={0.0001} step="any" required placeholder={t('invOnHandPh')} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">{t('invUnit')}</span>
          <select className="input" value={unit || selected?.unit || ''} onChange={(e) => setUnit(e.target.value)}>
            {(units.length ? units : [{ id: 'u', code: selected?.unit || 'kg', name: selected?.unit || 'kg' }]).map((u) => (
              <option key={u.id} value={u.code}>
                {u.code}
              </option>
            ))}
          </select>
          <span className="block text-[11px] muted leading-snug">{t('invUnitRatioHint')}</span>
        </label>
      </div>
      <input className="input" type="number" min={0} step="any" placeholder={t('invUnitCost')} value={cost} onChange={(e) => setCost(e.target.value)} />
      <select className="input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}>
        <option value="">{t('invPreferredSupplier')}…</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      <input className="input" placeholder={t('invNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn-primary">{t('invRecordStockIn')}</button>
    </form>
  );
}

export function OutboundStockPage() {
  const { t } = useI18n();
  const { items, reload } = useItems();
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<'waste' | 'out'>('waste');
  const [note, setNote] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/merchant/inventory/items/${itemId}/stock-out`, {
        qty: Number(qty),
        reason,
        note: note || undefined,
      });
      toast.success(reason === 'waste' ? t('invWasteSaved') : t('invOutboundSaved'));
      setQty('');
      setNote('');
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  return (
    <form className="card max-w-lg space-y-3" onSubmit={(e) => void submit(e)}>
      <p className="text-xs muted">{t('invOutboundHint')}</p>
      <select className="input" value={itemId} required onChange={(e) => setItemId(e.target.value)}>
        <option value="">{t('invSelectItem')}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.onHand} {i.unit})
          </option>
        ))}
      </select>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value as 'waste' | 'out')}>
        <option value="waste">{t('invTabWaste')}</option>
        <option value="out">{t('invOutboundOther')}</option>
      </select>
      <input className="input" type="number" min={0.0001} step="any" required placeholder={t('invQty')} value={qty} onChange={(e) => setQty(e.target.value)} />
      <input className="input" placeholder={t('invNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn-primary">{t('invRecordOutbound')}</button>
    </form>
  );
}

export function StockCountingPage() {
  const { t } = useI18n();
  const { items, reload } = useItems();
  const [itemId, setItemId] = useState('');
  const [realQty, setRealQty] = useState('');
  const [note, setNote] = useState('');
  const selected = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/merchant/inventory/items/${itemId}/count`, {
        realQty: Number(realQty),
        note: note || undefined,
      });
      toast.success(t('invCountSaved'));
      setNote('');
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  return (
    <form className="card max-w-lg space-y-3" onSubmit={(e) => void submit(e)}>
      <p className="text-xs muted">{t('invCountHint')}</p>
      <select
        className="input"
        value={itemId}
        required
        onChange={(e) => {
          setItemId(e.target.value);
          const found = items.find((i) => i.id === e.target.value);
          setRealQty(found ? String(found.onHand) : '');
        }}
      >
        <option value="">{t('invSelectItem')}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      {selected && (
        <p className="text-xs muted">
          {t('invSystemQty')}: {selected.onHand} {selected.unit}
        </p>
      )}
      <input className="input" type="number" min={0} step="any" required placeholder={t('invRealQty')} value={realQty} onChange={(e) => setRealQty(e.target.value)} />
      <input className="input" placeholder={t('invNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn-primary">{t('invRecordCount')}</button>
    </form>
  );
}

export function StockHistoryPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      type: string;
      qty: string;
      note?: string | null;
      supplierName?: string | null;
      createdAt: string;
      item?: { name?: string; unit?: string };
    }>
  >([]);

  useEffect(() => {
    api
      .get('/merchant/inventory/movements', { params: { limit: 200 } })
      .then((res) => setRows(res.data.movements || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="card !p-0 table-scroll">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-[var(--bg-muted)] text-left">
          <tr>
            <th className="px-3 py-2">{t('invWhen')}</th>
            <th className="px-3 py-2">{t('invItemName')}</th>
            <th className="px-3 py-2">{t('invMoveType')}</th>
            <th className="px-3 py-2">{t('invQty')}</th>
            <th className="px-3 py-2">{t('invNote')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center muted">
                {t('invNoHistory')}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
              <td className="px-3 py-2">{r.item?.name || '—'}</td>
              <td className="px-3 py-2 text-xs uppercase">{r.type}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.qty} {r.item?.unit || ''}
              </td>
              <td className="px-3 py-2 text-xs">
                {[r.supplierName, r.note].filter(Boolean).join(' · ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
