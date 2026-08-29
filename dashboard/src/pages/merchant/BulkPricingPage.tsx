import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Percent, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLocationStore } from '@/store/location';

type PreviewRow = {
  productId: string;
  name: string;
  currentPrice: number;
  newPrice: number;
};

export default function BulkPricingPage() {
  const { t } = useI18n();
  const { locations } = useLocationStore();
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState('');
  const [operation, setOperation] = useState<'increase' | 'decrease'>('increase');
  const [valueType, setValueType] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState('2');
  const [roundTo, setRoundTo] = useState('0.05');
  const [scopeLocationIds, setScopeLocationIds] = useState<string[]>([]);
  const [previewToken, setPreviewToken] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/merchant/categories');
        setCategories(res.data?.categories || res.data?.data || []);
      } catch {
        /* optional */
      }
    })();
  }, []);

  const toggleLocation = (id: string) => {
    setScopeLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runPreview = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/merchant/hq/bulk-pricing/preview', {
        locationIds: scopeLocationIds.length ? scopeLocationIds : undefined,
        categoryIds: categoryId ? [categoryId] : undefined,
        operation,
        valueType,
        value: Number(value) || 0,
        roundTo: Number(roundTo) || null,
      });
      setPreviewToken(res.data?.token || '');
      setRows(res.data?.rows || []);
      setConfirmText('');
      toast.success(t('bulkPricingPreviewReady', { count: res.data?.affectedCount || 0 }));
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!previewToken) return;
    if (confirmText.trim().toUpperCase() !== 'APPLY') {
      toast.error(t('bulkPricingTypeApply'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/merchant/hq/bulk-pricing/apply', {
        previewToken,
        locationIds: scopeLocationIds.length ? scopeLocationIds : undefined,
      });
      toast.success(t('bulkPricingApplied', { count: res.data?.affectedCount || 0 }));
      setRows([]);
      setPreviewToken('');
      setConfirmText('');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Apply failed');
    } finally {
      setLoading(false);
    }
  };

  const sample = useMemo(() => rows.slice(0, 12), [rows]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t('bulkPricingTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('bulkPricingDescription')}</p>
      </div>

      <form onSubmit={runPreview} className="rounded-lg border border-[var(--border)] p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">{t('bulkPricingCategory')}</label>
          <select className="input w-full mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('bulkPricingAllProducts')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {locations.length > 1 ? (
          <div>
            <label className="text-sm font-medium">{t('bulkPricingLocations')}</label>
            <p className="text-xs text-[var(--text-muted)] mb-2">{t('bulkPricingLocationsHint')}</p>
            <div className="space-y-1">
              {locations.map((loc) => (
                <label key={loc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scopeLocationIds.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                  />
                  {loc.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{t('bulkPricingOperation')}</label>
            <select
              className="input w-full mt-1"
              value={operation}
              onChange={(e) => setOperation(e.target.value as 'increase' | 'decrease')}
            >
              <option value="increase">{t('bulkPricingIncrease')}</option>
              <option value="decrease">{t('bulkPricingDecrease')}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t('bulkPricingValueType')}</label>
            <select
              className="input w-full mt-1"
              value={valueType}
              onChange={(e) => setValueType(e.target.value as 'fixed' | 'percent')}
            >
              <option value="fixed">{t('bulkPricingFixed')}</option>
              <option value="percent">
                <Percent className="w-3 h-3 inline" /> {t('bulkPricingPercent')}
              </option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{t('bulkPricingValue')}</label>
            <input
              className="input w-full mt-1"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('bulkPricingRoundTo')}</label>
            <input
              className="input w-full mt-1"
              type="number"
              step="0.01"
              value={roundTo}
              onChange={(e) => setRoundTo(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? t('loading') : t('bulkPricingPreview')}
        </button>
      </form>

      {rows.length > 0 ? (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <h2 className="font-medium">{t('bulkPricingPreviewResults', { count: rows.length })}</h2>
          <div className="max-h-64 overflow-y-auto text-sm divide-y divide-[var(--border)]">
            {sample.map((r) => (
              <div key={r.productId} className="py-2 flex justify-between gap-3">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 tabular-nums">
                  {r.currentPrice.toFixed(2)} → {r.newPrice.toFixed(2)}
                </span>
              </div>
            ))}
            {rows.length > sample.length ? (
              <p className="text-xs text-[var(--text-muted)] pt-2">
                {t('bulkPricingMoreRows', { count: rows.length - sample.length })}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium">{t('bulkPricingConfirmLabel')}</label>
            <input
              className="input w-full mt-1"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="APPLY"
            />
          </div>
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void apply()}>
            {t('bulkPricingApply')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
