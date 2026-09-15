import { useI18n } from '@/lib/i18n';

type Props = {
  subtotal: number;
  threshold: number;
  className?: string;
};

/** Cart sidebar: progress toward free delivery threshold. */
export default function ShopFreeDeliveryProgress({ subtotal, threshold, className = '' }: Props) {
  const { t } = useI18n();
  if (!threshold || threshold <= 0) return null;

  const met = subtotal >= threshold;
  const pct = met ? 100 : Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);

  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white px-3 py-2.5 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-2 text-sm">
        <span className="text-lg leading-none" aria-hidden>
          📦
        </span>
        <p className={`flex-1 ${met ? 'text-emerald-700 font-medium' : 'text-stone-700'}`}>
          {met
            ? t('shopFreeDeliveryUnlocked')
            : t('shopFreeDeliveryProgress').replace('{amount}', remaining.toFixed(2))}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            met ? 'bg-emerald-500' : 'bg-sky-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
