import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';

type TransferRow = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  itemId: string;
  qty: string;
  status: string;
  note?: string | null;
  createdAt: string;
  item?: { id: string; name: string; unit: string } | null;
};

type InvItem = { id: string; name: string; unit: string };

export default function InventoryTransfersPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fromLocationId: '',
    toLocationId: '',
    itemId: '',
    qty: '1',
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trRes, itemsRes] = await Promise.all([
        api.get('/merchant/inventory/transfers'),
        api.get('/merchant/inventory/items'),
      ]);
      setTransfers(trRes.data?.transfers || []);
      setItems((itemsRes.data?.items || []).map((i: InvItem) => ({ id: i.id, name: i.name, unit: i.unit })));
    } catch {
      toast.error(t('invTransferLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const locName = (id: string) => locations.find((l) => l.id === id)?.name || id.slice(0, 8);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/inventory/transfers', {
        ...form,
        qty: Number(form.qty),
      });
      toast.success(t('invTransferCreated'));
      setForm({ fromLocationId: '', toLocationId: '', itemId: '', qty: '1', note: '' });
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('saveFailed'));
    }
  };

  const confirm = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/merchant/inventory/transfers/${id}/confirm`);
      toast.success(t('invTransferConfirmed'));
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/merchant/inventory/transfers/${id}/cancel`);
      toast.success(t('invTransferCancelled'));
      await load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (locations.length < 2) {
    return (
      <div className="p-4 text-sm text-[var(--text-muted)]">
        {t('invTransferNeedsLocations')}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          {t('invTransferTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('invTransferDescription')}</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            {t('invTransferFrom')}
            <select
              className="input mt-1 w-full"
              value={form.fromLocationId}
              onChange={(e) => setForm({ ...form, fromLocationId: e.target.value })}
              required
            >
              <option value="">{t('selectLocation')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t('invTransferTo')}
            <select
              className="input mt-1 w-full"
              value={form.toLocationId}
              onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}
              required
            >
              <option value="">{t('selectLocation')}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          {t('invTransferItem')}
          <select
            className="input mt-1 w-full"
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
            required
          >
            <option value="">{t('invTransferSelectItem')}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {t('invTransferQty')}
          <input
            type="number"
            min={0.0001}
            step="any"
            className="input mt-1 w-full"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            required
          />
        </label>
        <label className="block text-sm">
          {t('notes')}
          <input
            className="input mt-1 w-full"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <button type="submit" className="btn-primary">
          {t('invTransferCreate')}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-medium">{t('invTransferHistory')}</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t('invTransferEmpty')}</p>
        ) : (
          transfers.map((tr) => (
            <div key={tr.id} className="rounded border border-[var(--border)] px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{tr.item?.name || tr.itemId}</span>
                <span className="uppercase text-xs text-[var(--text-muted)]">{tr.status}</span>
              </div>
              <p className="text-[var(--text-muted)]">
                {locName(tr.fromLocationId)} → {locName(tr.toLocationId)} · {Number(tr.qty).toFixed(2)}{' '}
                {tr.item?.unit || ''}
              </p>
              {tr.status === 'pending' ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={busyId === tr.id}
                    onClick={() => void confirm(tr.id)}
                  >
                    {t('invTransferConfirm')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={busyId === tr.id}
                    onClick={() => void cancel(tr.id)}
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
