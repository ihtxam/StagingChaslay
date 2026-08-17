import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, TrendingDown, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Preview = {
  monthKey: string;
  targetPercent: number;
  currentCashTotal: number;
  targetCashTotal: number;
  reductionNeeded: number;
  eligibleOrderCount: number;
  adjustableItemCount: number;
  alreadyAdjustedCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
};

export default function SalesAdjustmentModal({ open, onClose, onApplied }: Props) {
  const { t } = useI18n();
  const [percent, setPercent] = useState<20 | 40>(20);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/merchant/pos/sales-adjustment/preview?percent=${percent}`);
      setPreview(res.data.preview as Preview);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('salesAdjPreviewFailed'));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [percent, t]);

  useEffect(() => {
    if (!open) return;
    setConfirmText('');
    void loadPreview();
  }, [open, loadPreview]);

  const apply = async () => {
    if (confirmText.trim().toUpperCase() !== 'REDUCE') return;
    setApplying(true);
    try {
      const res = await api.post('/merchant/pos/sales-adjustment/apply', { percent });
      const result = res.data.result as {
        reductionApplied: number;
        ordersAdjusted: number;
        itemsAdjusted: number;
      };
      toast.success(
        t('salesAdjApplied')
          .replace('{amount}', result.reductionApplied.toFixed(2))
          .replace('{orders}', String(result.ordersAdjusted))
          .replace('{items}', String(result.itemsAdjusted))
      );
      onApplied?.();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('salesAdjApplyFailed'));
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--bg-elevated)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <TrendingDown size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold">{t('salesAdjTitle')}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t('salesAdjSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex gap-2">
            {([20, 40] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPercent(p)}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm font-extrabold transition ${
                  percent === p
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-[var(--border)] bg-[var(--bg-muted)]/40 hover:bg-[var(--bg-muted)]'
                }`}
              >
                −{p}%
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {t('salesAdjCashOnlyNote')}
            </p>
          </div>

          {loading ? (
            <p className="text-center text-sm text-[var(--text-muted)]">{t('salesAdjLoading')}</p>
          ) : preview ? (
            <dl className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">{t('salesAdjMonth')}</dt>
                <dd className="font-semibold tabular-nums">{preview.monthKey}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">{t('salesAdjCurrentCash')}</dt>
                <dd className="font-semibold tabular-nums">
                  CHF {preview.currentCashTotal.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">{t('salesAdjTargetCash')}</dt>
                <dd className="font-extrabold tabular-nums text-amber-800">
                  CHF {preview.targetCashTotal.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">{t('salesAdjReduction')}</dt>
                <dd className="font-semibold tabular-nums">
                  CHF {preview.reductionNeeded.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <dt className="text-[var(--text-muted)]">{t('salesAdjEligibleOrders')}</dt>
                <dd className="font-semibold">{preview.eligibleOrderCount}</dd>
              </div>
              {preview.alreadyAdjustedCount > 0 ? (
                <p className="pt-1 text-xs text-[var(--text-muted)]">
                  {t('salesAdjAlreadyAdjusted').replace(
                    '{n}',
                    String(preview.alreadyAdjustedCount)
                  )}
                </p>
              ) : null}
            </dl>
          ) : null}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-muted)]">
              {t('salesAdjConfirmLabel')}
            </label>
            <input
              type="text"
              className="input w-full font-mono uppercase"
              placeholder="REDUCE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={applying}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-amber-700 hover:bg-amber-800"
            disabled={
              applying ||
              loading ||
              !preview ||
              preview.reductionNeeded <= 0 ||
              confirmText.trim().toUpperCase() !== 'REDUCE'
            }
            onClick={() => void apply()}
          >
            {applying ? t('salesAdjApplying') : t('salesAdjApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
