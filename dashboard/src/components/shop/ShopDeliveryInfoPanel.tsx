import { Bike, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  hasChannelHours,
  summarizeChannelHours,
  type StoreHoursChannel,
} from '@/lib/shop-hours-display';
import type { ShopDeliveryZone, ShopDeliveryZipRule } from '@/hooks/useShopDeliveryPricing';
import type { StoreHours } from '@/lib/shop-hours';

const ZONE_COLORS = ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'];

type Props = {
  storeHours?: StoreHours | null;
  zones?: ShopDeliveryZone[];
  zipRules?: ShopDeliveryZipRule[];
  deliveryMode?: 'zones' | 'zipcode';
  hoursChannel?: StoreHoursChannel;
  compact?: boolean;
  className?: string;
};

/**
 * Delivery hours + zone/pricing block for store info sheet and homepage hours sections.
 */
export default function ShopDeliveryInfoPanel({
  storeHours,
  zones = [],
  zipRules = [],
  deliveryMode = 'zones',
  hoursChannel = 'delivery',
  compact = false,
  className = '',
}: Props) {
  const { t, locale } = useI18n();
  const deliveryHours = summarizeChannelHours(storeHours, hoursChannel, locale);
  const hasDeliveryHours = hasChannelHours(storeHours, hoursChannel);
  const pricingItems =
    deliveryMode === 'zipcode'
      ? zipRules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          minOrderAmount: rule.minOrderAmount,
          deliveryFee: rule.deliveryFee,
          color: null as string | null,
        }))
      : zones.map((z) => ({
          id: z.id,
          name: z.name,
          minOrderAmount: z.minOrderAmount,
          deliveryFee: z.deliveryFee,
          color: z.color,
        }));
  const hasPricing = pricingItems.length > 0;
  const gap = compact ? 'space-y-3' : 'space-y-4';
  const heading = compact ? 'text-sm font-semibold' : 'text-base font-semibold';

  return (
    <div className={`${gap} ${className}`.trim()}>
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        <p className={`${heading} flex items-center gap-1.5`}>
          <Clock className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} />
          {t('shopDeliveryTimes')}
        </p>
        {hasDeliveryHours ? (
          <div className={`space-y-1 ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>
            {deliveryHours.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <span className="text-stone-600">{row.label}</span>
                <span className="text-right font-medium tabular-nums">{row.hours}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">{t('shopHoursNotSet')}</p>
        )}
      </div>

      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        <p className={`${heading} flex items-center gap-1.5`}>
          <Bike className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} />
          {t('shopDeliveryCosts')}
        </p>
        {hasPricing ? (
          <ul className={`space-y-1.5 ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>
            {pricingItems.map((item, i) => {
              const color = item.color || ZONE_COLORS[i % ZONE_COLORS.length];
              return (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-xs text-stone-500">
                      {t('shopZoneMinFee')
                        .replace('{min}', Number(item.minOrderAmount || 0).toFixed(2))
                        .replace('{fee}', Number(item.deliveryFee || 0).toFixed(2))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : hasDeliveryHours ? (
          <p className="text-sm text-stone-500">{t('shopDeliveryZonesOnRequest')}</p>
        ) : (
          <p className="text-sm text-stone-500">{t('shopNoDeliveryZones')}</p>
        )}
      </div>
    </div>
  );
}
