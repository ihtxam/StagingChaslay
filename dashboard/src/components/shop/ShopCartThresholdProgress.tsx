import { Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  subtotal: number;
  threshold: number;
  /** i18n key with `{amount}` placeholder for remaining CHF */
  progressKey: string;
  /** i18n key when threshold is met */
  unlockedKey: string;
  /** i18n key with `{amount}` for short remaining label under bar */
  remainingKey: string;
  variant?: 'min' | 'free';
  className?: string;
};

/** Cart sidebar: progress toward minimum order or free delivery. */
export default function ShopCartThresholdProgress({
  subtotal,
  threshold,
  progressKey,
  unlockedKey,
  remainingKey,
  variant = 'min',
  className = '',
}: Props) {
  const { t } = useI18n();
  if (!threshold || threshold <= 0) return null;

  const met = subtotal >= threshold;
  const pct = met ? 100 : Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);
  const barColor = met ? 'bg-emerald-500' : variant === 'free' ? 'bg-sky-500' : 'bg-emerald-500';

  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white px-3 py-2.5 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-2 text-sm">
        <Info
          className={`mt-0.5 h-4 w-4 shrink-0 ${met ? 'text-emerald-600' : 'text-amber-600'}`}
          strokeWidth={2}
          aria-hidden
        />
        <p className={`flex-1 leading-snug ${met ? 'font-medium text-emerald-700' : 'text-stone-800'}`}>
          {met
            ? t(unlockedKey)
            : t(progressKey).replace('{amount}', remaining.toFixed(2))}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!met ? (
        <p className="mt-1.5 text-center text-xs text-stone-500">
          {t(remainingKey).replace('{amount}', remaining.toFixed(2))}
        </p>
      ) : null}
    </div>
  );
}
