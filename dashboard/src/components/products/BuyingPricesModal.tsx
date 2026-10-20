import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { normalizeMoneyInput } from '@/lib/money';

type Row = {
  id: string;
  name: string;
  price: number;
  cost: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function BuyingPricesModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/products', { params: { page: 1, limit: 500 } });
      const list = (res.data.products || res.data.data || []) as Array<{
        id: string;
        name: string;
        price: string | number;
        cost?: string | number | null;
      }>;
      setRows(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          cost: p.cost != null && p.cost !== '' ? String(p.cost) : '',
        }))
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('productsBuyingPricesLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const save = async () => {
    setSaving(true);
    try {
      const updates = rows.filter((r) => r.cost.trim() !== '');
      await Promise.all(
        updates.map((r) =>
          api.put(`/merchant/products/${r.id}`, {
            cost: r.cost.trim() ? r.cost.trim() : null,
          })
        )
      );
      toast.success(t('productsBuyingPricesSaved'));
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('productsBuyingPricesSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const money = (n: number) => `CHF ${n.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('close')} onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">{t('productsBuyingPricesTitle')}</h2>
            <p className="text-xs muted mt-0.5">{t('productBuyingPriceHint')}</p>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-[var(--bg-muted)]" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-[var(--border)]">
          <input
            className="input w-full"
            placeholder={t('searchProductsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <p className="py-8 text-center text-sm muted">{t('loadingProducts')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="py-2 pr-2 font-medium">{t('reportsProduct')}</th>
                  <th className="py-2 pr-2 font-medium text-right">{t('reportsSalePrice')}</th>
                  <th className="py-2 font-medium text-right">{t('productBuyingPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)]/60">
                    <td className="py-2 pr-2 font-medium">{row.name}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{money(row.price)}</td>
                    <td className="py-2">
                      <input
                        className="input w-full max-w-[7rem] ml-auto text-right tabular-nums"
                        inputMode="decimal"
                        value={row.cost}
                        onChange={(e) => {
                          const cost = normalizeMoneyInput(e.target.value);
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, cost } : r))
                          );
                        }}
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving || loading}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
