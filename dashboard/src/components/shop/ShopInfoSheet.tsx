import { useEffect, useMemo, useState } from 'react';
import { Bike, Clock, ExternalLink, Mail, MapPin, Phone, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { summarizeStoreHours } from '@/lib/shop-hours-display';
import { resolveShopKey } from '@/lib/shop-cart';
import { useShopDeliveryPricing } from '@/hooks/useShopDeliveryPricing';
import ShopDeliveryInfoPanel from '@/components/shop/ShopDeliveryInfoPanel';
import ShopDeliveryZoneMap from '@/components/shop/ShopDeliveryZoneMap';

type Zone = {
  id: string;
  name: string;
  polygon: [number, number][]; // lng,lat
  minOrderAmount: string | number;
  deliveryFee: string | number;
  color?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  merchant: any;
  zones?: Zone[];
  shopKey?: string | null;
};

type InfoTab = 'contact' | 'hours' | 'delivery';

/**
 * Store info sheet: contact, hours, and delivery zones.
 */
export default function ShopInfoSheet({ open, onClose, merchant, zones: zonesProp, shopKey: shopKeyProp }: Props) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<InfoTab>('contact');

  const shopKey = useMemo(
    () => shopKeyProp || resolveShopKey(merchant?.slug || merchant?.subdomain || merchant?.customDomain),
    [shopKeyProp, merchant?.slug, merchant?.subdomain, merchant?.customDomain]
  );

  const shouldFetchPricing = open && (!zonesProp || zonesProp.length === 0);
  const { zones: fetchedZones, zipRules, deliveryMode } = useShopDeliveryPricing(
    shopKey,
    shouldFetchPricing
  );

  const zones = zonesProp?.length ? zonesProp : fetchedZones;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setTab('contact');
    }
  }, [open]);

  const center = useMemo((): [number, number] => {
    const lat = Number(merchant?.latitude);
    const lng = Number(merchant?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5)) {
      return [lat, lng];
    }
    return [46.8182, 8.2275];
  }, [merchant?.latitude, merchant?.longitude]);

  const hoursRows = useMemo(
    () => summarizeStoreHours(merchant?.storeHours, merchant?.channels, locale),
    [merchant?.storeHours, merchant?.channels, locale]
  );

  const addressLine = [merchant?.address, merchant?.city].filter(Boolean).join(', ');

  const mapsUrl =
    merchant?.latitude && merchant?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`
      : merchant?.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${merchant.address} ${merchant.city || ''}`
          )}`
        : null;

  if (!open && !mounted) return null;

  const tabs: Array<{ id: InfoTab; label: string; icon: typeof MapPin }> = [
    { id: 'contact', label: t('shopContact'), icon: MapPin },
    { id: 'hours', label: t('shopHours'), icon: Clock },
    { id: 'delivery', label: t('shopDelivery'), icon: Bike },
  ];

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}>
      <button
        type="button"
        className={`absolute inset-0 bg-stone-900/40 transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label={t('shopClose')}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-3 top-[8%] mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition sm:inset-x-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[92dvh] sm:max-w-xl md:max-w-2xl ${
          open ? 'opacity-100' : 'translate-y-4 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t('shopStoreInfo')}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {merchant?.shopLogoUrl ? (
              <img
                src={merchant.shopLogoUrl}
                alt=""
                className="h-9 w-9 rounded-full object-contain"
              />
            ) : null}
            <p className="truncate text-base font-bold tracking-tight">{merchant?.name}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"
            onClick={onClose}
            aria-label={t('shopClose')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-4 mb-3 flex shrink-0 rounded-full bg-stone-100 p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const on = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold ${
                  on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'contact' ? (
            <div className="space-y-3">
              {addressLine ? (
                <p className="flex items-start gap-2 text-sm text-stone-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} />
                  <span>{addressLine}</span>
                </p>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
                >
                  {t('shopOpenInMaps')}
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ) : null}
              {mounted ? (
                <ShopDeliveryZoneMap
                  center={center}
                  zones={zones}
                  fitToZones={zones.some((z) => (z.polygon?.length ?? 0) >= 3)}
                  className="h-44 w-full sm:h-48"
                />
              ) : null}
              {merchant?.phone ? (
                <a
                  href={`tel:${String(merchant.phone).replace(/\s+/g, '')}`}
                  className="flex items-center gap-2 text-sm text-stone-800"
                >
                  <Phone className="h-4 w-4 text-stone-400" strokeWidth={2} />
                  {merchant.phone}
                </a>
              ) : null}
              {merchant?.email ? (
                <a
                  href={`mailto:${merchant.email}`}
                  className="flex items-center gap-2 text-sm text-stone-800"
                >
                  <Mail className="h-4 w-4 text-stone-400" strokeWidth={2} />
                  {merchant.email}
                </a>
              ) : null}
            </div>
          ) : null}

          {tab === 'hours' ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('shopOpeningHours')}</p>
              <div className="space-y-1 text-sm">
                {hoursRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <span className="text-stone-600">{row.label}</span>
                    <span className="text-right font-medium tabular-nums">{row.hours}</span>
                  </div>
                ))}
                {hoursRows.length === 0 ? (
                  <p className="text-stone-500 text-xs">{t('shopHoursNotSet')}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === 'delivery' ? (
            <div className="space-y-4">
              <ShopDeliveryInfoPanel
                compact
                storeHours={merchant?.storeHours}
                zones={zones}
                zipRules={zipRules}
                deliveryMode={deliveryMode}
              />
              {mounted && deliveryMode === 'zones' && zones.some((z) => (z.polygon?.length ?? 0) >= 3) ? (
                <ShopDeliveryZoneMap
                  center={center}
                  zones={zones}
                  fitToZones
                  className="h-52 w-full sm:h-60"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
