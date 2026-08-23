import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, TrendingDown, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type PeriodPreset = 'today' | 'last_week' | 'this_month' | 'last_month';

type Preview = {
  periodLabel: string;
  from: string;
  to: string;
  targetPercent: number;
  currentCashTotal: number;
  targetCashTotal: number;
  reductionNeeded: number;
  eligibleOrderCount: number;
  adjustableItemCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
};

const PERCENT_PRESETS = [10, 20, 30, 40, 50, 60, 70, 80] as const;

export default function SalesAdjustmentModal({ open, onClose, onApplied }: Props) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [percentPreset, setPercentPreset] = useState<number>(40);
  const [customPercent, setCustomPercent] = useState('');
  const [useCustomPercent, setUseCustomPercent] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const effectivePercent = resolvePercent(customPercent, percentPreset, useCustomPercent);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        percent: String(effectivePercent),
        preset: period,
      });
      const res = await api.get(`/merchant/pos/sales-adjustment/preview?${params}`);
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
  }, [effectivePercent, period, t]);

  useEffect(() => {
    if (!open) return;
    setConfirmText('');
    void loadPreview();
  }, [open, loadPreview]);

  const apply = async () => {
    if (confirmText.trim().toUpperCase() !== 'REDUCE') return;
    setApplying(true);
    try {
      const res = await api.post('/merchant/pos/sales-adjustment/apply', {
        percent: effectivePercent,
        preset: period,
      });
      const result = res.data.result as {
        reductionApplied: number;
        ordersAdjusted: number;
        itemsAdjusted: number;
        beforeCashTotal: number;
        afterCashTotal: number;
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[var(--bg-elevated)] shadow-2xl sm:rounded-2xl">
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
            aria-label={t('cancel')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-3 py-2.5 text-xs text-[var(--text-muted)]">
            {t('salesAdjHowItWorks')}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('salesAdjPeriod')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['today', t('reportsToday')],
                  ['last_week', t('reportsLastWeek')],
                  ['this_month', t('reportsThisMonth')],
                  ['last_month', t('reportsLastMonth')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriod(id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    period === id
                      ? 'border-amber-500 bg-amber-50 text-amber-900'
                      : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('salesAdjPercentLabel')}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {PERCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setUseCustomPercent(false);
                    setPercentPreset(p);
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-extrabold transition ${
                    !useCustomPercent && percentPreset === p
                      ? 'border-amber-500 bg-amber-50 text-amber-900'
                      : 'border-[var(--border)] bg-[var(--bg-muted)]/40 hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  −{p}%
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useCustomPercent}
                onChange={(e) => setUseCustomPercent(e.target.checked)}
              />
              <span>{t('salesAdjCustomPercent')}</span>
              <input
                type="number"
                min={1}
                max={99}
                className="input ml-auto w-20 py-1 text-sm"
                disabled={!useCustomPercent}
                value={customPercent}
                onChange={(e) => setCustomPercent(e.target.value)}
                placeholder="%"
              />
            </label>
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
                <dt className="text-[var(--text-muted)]">{t('salesAdjPeriod')}</dt>
                <dd className="text-right font-semibold">{preview.periodLabel}</dd>
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

function resolvePercent(custom: string, preset: number, isCustom: boolean): number {
  if (isCustom) {
    const n = Math.round(Number(custom));
    if (Number.isFinite(n) && n >= 1 && n <= 99) return n;
    return preset;
  }
  return preset;
}
