import { useI18n } from '@/lib/i18n';

type ZoneInfo = {
  minOrderAmount?: number | string | null;
  deliveryFee?: number | string | null;
  baseDeliveryFee?: number | string | null;
  freeDeliveryMinOrder?: number | string | null;
};

type Props = {
  zone?: ZoneInfo | null;
  deliverable?: boolean;
  className?: string;
};

/** Min order, delivery fee, and free-delivery threshold pills (delivery modal). */
export default function ShopDeliveryZoneBadges({ zone, deliverable, className = '' }: Props) {
  const { t } = useI18n();
  if (!deliverable || !zone) return null;

  const minOrder = Number(zone.minOrderAmount || 0);
  const baseFee = Number(zone.baseDeliveryFee ?? zone.deliveryFee ?? 0);
  const freeThreshold = Number(zone.freeDeliveryMinOrder || 0);

  const minBadge =
    minOrder > 0
      ? t('shopMinOrderBadge').replace('{amount}', minOrder.toFixed(2))
      : null;
  const feeBadge =
    baseFee > 0 ? t('shopDeliveryFeeBadge').replace('{amount}', baseFee.toFixed(2)) : null;
  const freeBadge =
    freeThreshold > 0
      ? t('shopFreeDeliveryFrom').replace('{amount}', freeThreshold.toFixed(2))
      : null;

  if (!minBadge && !feeBadge && !freeBadge) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {minBadge ? (
        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-800">
          {minBadge}
        </span>
      ) : null}
      {feeBadge ? (
        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-800">
          {feeBadge}
        </span>
      ) : null}
      {freeBadge ? (
        <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">
          {freeBadge}
        </span>
      ) : null}
    </div>
  );
}
