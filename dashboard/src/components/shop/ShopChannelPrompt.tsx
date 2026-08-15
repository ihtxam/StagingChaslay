import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ZipCityFields from '@/components/shop/ZipCityFields';
import type { ShopChannel } from '@/lib/shop-cart';
import { withDeliveryMinOrderStatus } from '@/lib/shop-delivery';
import { buildScheduleDays, type StoreHours } from '@/lib/shop-hours';
import { useI18n } from '@/lib/i18n';

type ChannelOption = {
  id: ShopChannel;
  label: string;
  etaMinutes: number;
  open: boolean;
  todayLabel?: string;
};

export type ShopFulfillmentConfirmPayload = {
  channel: ShopChannel;
  scheduledFor: string | null;
  address?: string;
  zipCode?: string;
  city?: string;
  lat?: number;
  lng?: number;
  deliveryInfo?: any;
};

type Props = {
  open: boolean;
  title?: string;
  subtitle?: string;
  options: ChannelOption[];
  selected: ShopChannel;
  confirmLabel?: string;
  onSelect: (channel: ShopChannel) => void;
  onConfirm: (payload: ShopFulfillmentConfirmPayload) => void;
  onClose?: () => void;
  dismissible?: boolean;
  withSchedule?: boolean;
  storeHours?: StoreHours | null;
  scheduledFor?: string | null;
  /** Delivery address fields (required when selected === delivery) */
  shopKey?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  subtotal?: number;
  /** Merchant coords for map fallback */
  merchantLat?: number | null;
  merchantLng?: number | null;
  /** Address-only mode (checkout) — hides channel toggle & schedule */
  addressOnly?: boolean;
};

function buildFullAddress(street: string, houseNumber: string, floor: string) {
  const parts = [street.trim(), houseNumber.trim()].filter(Boolean);
  const base = parts.join(' ').trim();
  const floorTrim = floor.trim();
  if (!base) return '';
  return floorTrim ? `${base}, ${floorTrim}` : base;
}

function splitAddressLine(line: string): { street: string; houseNumber: string; floor: string } {
  const trimmed = line.trim();
  if (!trimmed) return { street: '', houseNumber: '', floor: '' };
  const floorMatch = trimmed.match(/,\s*(étage|floor|stock|etage)\s*(.+)$/i);
  const floor = floorMatch ? floorMatch[0].replace(/^,\s*/i, '') : '';
  const withoutFloor = floorMatch ? trimmed.slice(0, floorMatch.index).trim() : trimmed;
  const lastSpace = withoutFloor.lastIndexOf(' ');
  if (lastSpace <= 0) return { street: withoutFloor, houseNumber: '', floor };
  const maybeNum = withoutFloor.slice(lastSpace + 1);
  if (/^\d+[a-zA-Z]?$/.test(maybeNum)) {
    return {
      street: withoutFloor.slice(0, lastSpace).trim(),
      houseNumber: maybeNum,
      floor,
    };
  }
  return { street: withoutFloor, houseNumber: '', floor };
}

/**
 * Full-screen fulfillment modal: delivery/takeaway toggle, map, address, schedule slots.
 */
export default function ShopChannelPrompt({
  open,
  title,
  subtitle,
  options,
  selected,
  confirmLabel,
  onSelect,
  onConfirm,
  onClose,
  dismissible = true,
  withSchedule = false,
  storeHours,
  scheduledFor,
  shopKey = '',
  address: initialAddress = '',
  zipCode: initialZip = '',
  city: initialCity = '',
  subtotal = 0,
  merchantLat,
  merchantLng,
  addressOnly = false,
}: Props) {
  const { t, locale } = useI18n();
  const [dayOffset, setDayOffset] = useState(0);
  const [slotValue, setSlotValue] = useState<string | null>(null);
  const [chooseDateOpen, setChooseDateOpen] = useState(false);

  const parsed = useMemo(() => splitAddressLine(initialAddress), [initialAddress]);
  const [street, setStreet] = useState(parsed.street);
  const [houseNumber, setHouseNumber] = useState(parsed.houseNumber);
  const [floor, setFloor] = useState(parsed.floor);
  const [zipCode, setZipCode] = useState(initialZip);
  const [city, setCity] = useState(initialCity);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  const shopLocale = locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH';
  const eta = options.find((o) => o.id === selected)?.etaMinutes || 30;
  const channelOpen = options.find((o) => o.id === selected)?.open;
  const showDeliveryPanel = addressOnly || selected === 'delivery';
  const fullAddress = buildFullAddress(street, houseNumber, floor);

  const effectiveDeliveryInfo = useMemo(
    () => withDeliveryMinOrderStatus(deliveryInfo, subtotal),
    [deliveryInfo, subtotal]
  );

  const scheduleDays = useMemo(() => {
    if (!withSchedule || addressOnly) return [];
    return buildScheduleDays({
      storeHours: storeHours || null,
      channel: selected,
      leadMinutes: Math.max(15, eta),
      intervalMinutes: 15,
      horizonDays: 3,
      locale: shopLocale,
    });
  }, [withSchedule, addressOnly, storeHours, selected, eta, shopLocale]);

  useEffect(() => {
    if (!open) return;
    const next = splitAddressLine(initialAddress);
    setStreet(next.street);
    setHouseNumber(next.houseNumber);
    setFloor(next.floor);
    setZipCode(initialZip);
    setCity(initialCity);
    setError(null);
    setDeliveryInfo(null);
    setLat(undefined);
    setLng(undefined);
    setChooseDateOpen(false);
  }, [open, initialAddress, initialZip, initialCity]);

  useEffect(() => {
    if (!open || !withSchedule || addressOnly) return;
    setChooseDateOpen(false);
    const preferred =
      scheduleDays.find((d) => d.offset === dayOffset) || scheduleDays[0] || null;
    setDayOffset(preferred?.offset ?? 0);
    const match = preferred?.slots.find((s) => s.value === scheduledFor);
    setSlotValue(match?.value || preferred?.slots[0]?.value || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, withSchedule, addressOnly, scheduleDays.length]);

  const mapLat = lat ?? (merchantLat != null ? Number(merchantLat) : undefined);
  const mapLng = lng ?? (merchantLng != null ? Number(merchantLng) : undefined);
  const mapEmbedUrl =
    mapLat != null && mapLng != null
      ? `https://maps.google.com/maps?q=${mapLat},${mapLng}&z=15&output=embed`
      : fullAddress.trim() && zipCode
        ? `https://maps.google.com/maps?q=${encodeURIComponent(`${fullAddress}, ${zipCode} ${city} Switzerland`)}&z=15&output=embed`
        : mapLat != null && mapLng != null
          ? `https://maps.google.com/maps?q=${mapLat},${mapLng}&z=14&output=embed`
          : null;

  const verifyDelivery = async () => {
    if (!fullAddress.trim()) {
      setError(t('shopEnterDeliveryAddress'));
      return;
    }
    if (!shopKey) return;
    setChecking(true);
    setError(null);
    try {
      const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, {
        query: `${fullAddress}, ${zipCode} ${city} Switzerland`,
      });
      const nextLat = geoRes.data.found ? Number(geoRes.data.lat) : undefined;
      const nextLng = geoRes.data.found ? Number(geoRes.data.lng) : undefined;
      if (nextLat != null && nextLng != null) {
        setLat(nextLat);
        setLng(nextLng);
      }
      const res = await axios.post(`/api/shop/${shopKey}/check-delivery`, {
        lat: nextLat,
        lng: nextLng,
        zipCode,
        subtotal,
      });
      setDeliveryInfo(res.data);
      if (!res.data.deliverable) {
        setError(res.data.error || t('shopOutsideDelivery'));
      }
    } catch (e: any) {
      setError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      setDeliveryInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const handleConfirm = () => {
    if (showDeliveryPanel && shopKey) {
      if (!fullAddress.trim()) {
        setError(t('shopEnterDeliveryAddress'));
        return;
      }
      if (!effectiveDeliveryInfo?.deliverable) {
        setError(t('shopConfirmDeliveryVerifyFirst'));
        return;
      }
      onConfirm({
        channel: addressOnly ? 'delivery' : selected,
        scheduledFor: withSchedule && !addressOnly ? slotValue : null,
        address: fullAddress,
        zipCode,
        city,
        lat,
        lng,
        deliveryInfo: effectiveDeliveryInfo,
      });
      return;
    }

    onConfirm({
      channel: selected,
      scheduledFor: withSchedule ? slotValue : null,
    });
  };

  if (!open) return null;

  const activeDay = scheduleDays.find((d) => d.offset === dayOffset) || scheduleDays[0];
  const laterDays = scheduleDays.filter((d) => d.offset >= 2);
  const dayTab =
    dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : 'choose';

  const minBadge =
    effectiveDeliveryInfo?.deliverable && effectiveDeliveryInfo.zone?.minOrderAmount > 0
      ? t('shopMinOrderBadge').replace(
          '{amount}',
          Number(effectiveDeliveryInfo.zone.minOrderAmount).toFixed(2)
        )
      : null;
  const fee = Number(effectiveDeliveryInfo?.zone?.deliveryFee ?? 0);
  const freeBadge =
    effectiveDeliveryInfo?.deliverable && fee === 0
      ? t('shopFreeDeliveryFrom').replace(
          '{amount}',
          Number(effectiveDeliveryInfo.zone?.minOrderAmount || 0).toFixed(2)
        )
      : effectiveDeliveryInfo?.deliverable && fee > 0
        ? t('shopDeliveryFeeBadge').replace('{amount}', fee.toFixed(2))
        : null;

  const resolvedTitle =
    title ||
    (addressOnly
      ? t('shopConfirmDeliveryTitle')
      : showDeliveryPanel && selected === 'delivery'
        ? t('shopConfirmDeliveryTitle')
        : t('shopChooseHow'));
  const resolvedSubtitle =
    subtitle ||
    (addressOnly
      ? t('shopConfirmDeliveryHint')
      : selected === 'delivery'
        ? t('shopConfirmDeliveryHint')
        : undefined);
  const resolvedConfirm = confirmLabel || t('shopContinue');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/55 backdrop-blur-[2px]"
        aria-label={t('shopClose')}
        onClick={() => {
          if (dismissible) onClose?.();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex w-full bg-white shadow-2xl overflow-hidden ${
          showDeliveryPanel
            ? 'max-w-5xl max-h-[96dvh] flex-col lg:flex-row rounded-none sm:rounded-2xl'
            : 'max-w-lg max-h-[92dvh] flex-col rounded-none sm:rounded-2xl'
        }`}
      >
        {showDeliveryPanel ? (
          <div className="relative hidden lg:block lg:w-[44%] min-h-[280px] lg:min-h-0 bg-stone-100">
            {mapEmbedUrl ? (
              <iframe
                title={t('shopGetMap')}
                src={mapEmbedUrl}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-500 p-8">
                <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                  📍
                </div>
                <p className="text-sm text-center">{t('shopMapPlaceholder')}</p>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stone-900/20 to-transparent pointer-events-none" />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col min-h-0 max-h-[96dvh]">
          <div className="relative shrink-0 px-5 pt-4 pb-3 border-b border-stone-100">
            {dismissible && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 text-lg font-bold hover:bg-stone-200"
                aria-label={t('shopClose')}
              >
                ×
              </button>
            ) : null}
            <h2 className="text-lg font-bold tracking-tight text-stone-900 pr-10">{resolvedTitle}</h2>
            {resolvedSubtitle ? (
              <p className="mt-1 text-sm text-stone-500 leading-snug">{resolvedSubtitle}</p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!addressOnly && options.length > 1 ? (
              <div className="inline-flex w-full rounded-full bg-stone-100 p-1 gap-1">
                {options.map((opt) => {
                  const on = selected === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelect(opt.id);
                        setError(null);
                        setDeliveryInfo(null);
                      }}
                      className={`flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition ${
                        on
                          ? 'bg-amber-700 text-white shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {showDeliveryPanel && shopKey ? (
              <div className="space-y-3">
                <div className="lg:hidden rounded-xl overflow-hidden border border-stone-200 h-40 bg-stone-100">
                  {mapEmbedUrl ? (
                    <iframe
                      title={t('shopGetMap')}
                      src={mapEmbedUrl}
                      className="h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-stone-500">
                      {t('shopMapPlaceholder')}
                    </div>
                  )}
                </div>

                <input
                  className="w-full border border-stone-200 px-3 py-2.5 text-sm rounded-xl focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                  placeholder={t('shopSearchAddress')}
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    setDeliveryInfo(null);
                    setError(null);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full border border-stone-200 px-3 py-2.5 text-sm rounded-xl focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    placeholder={t('shopHouseNumber')}
                    value={houseNumber}
                    onChange={(e) => {
                      setHouseNumber(e.target.value);
                      setDeliveryInfo(null);
                      setError(null);
                    }}
                  />
                  <input
                    className="w-full border border-stone-200 px-3 py-2.5 text-sm rounded-xl focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
                    placeholder={t('shopFloor')}
                    value={floor}
                    onChange={(e) => {
                      setFloor(e.target.value);
                      setDeliveryInfo(null);
                      setError(null);
                    }}
                  />
                </div>
                <ZipCityFields
                  shopKey={shopKey}
                  zipCode={zipCode}
                  city={city}
                  onZipChange={(z) => {
                    setZipCode(z);
                    setDeliveryInfo(null);
                  }}
                  onCityChange={(c) => {
                    setCity(c);
                    setDeliveryInfo(null);
                  }}
                  zipClassName="w-full border border-stone-200 px-3 py-2.5 text-sm rounded-xl"
                  cityClassName="w-full border border-stone-200 px-3 py-2.5 text-sm rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => void verifyDelivery()}
                  className="w-full border border-stone-800 text-sm font-semibold py-2.5 rounded-xl hover:bg-stone-50"
                  disabled={checking}
                >
                  {checking ? t('shopChecking') : t('shopCheckDeliveryZone')}
                </button>

                {effectiveDeliveryInfo?.deliverable ? (
                  <div className="flex flex-wrap gap-2">
                    {minBadge ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                        {minBadge}
                      </span>
                    ) : null}
                    {freeBadge ? (
                      <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-900">
                        {freeBadge}
                      </span>
                    ) : null}
                    {!effectiveDeliveryInfo.meetsMinOrder && effectiveDeliveryInfo.message ? (
                      <span className="text-xs text-amber-800">{effectiveDeliveryInfo.message}</span>
                    ) : null}
                  </div>
                ) : null}
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
            ) : null}

            {withSchedule && !addressOnly ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-stone-800">
                  {selected === 'delivery' ? t('shopDateTimeDelivery') : t('shopDateTimePickup')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {scheduleDays.some((d) => d.offset === 0) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDayOffset(0);
                        setChooseDateOpen(false);
                        const d = scheduleDays.find((x) => x.offset === 0);
                        setSlotValue(d?.slots[0]?.value || null);
                      }}
                      className={`rounded-xl px-2 py-2.5 text-center text-sm font-medium border transition ${
                        dayTab === 'today'
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {t('shopToday')}
                    </button>
                  ) : null}
                  {scheduleDays.some((d) => d.offset === 1) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDayOffset(1);
                        setChooseDateOpen(false);
                        const d = scheduleDays.find((x) => x.offset === 1);
                        setSlotValue(d?.slots[0]?.value || null);
                      }}
                      className={`rounded-xl px-2 py-2.5 text-center text-sm font-medium border transition ${
                        dayTab === 'tomorrow'
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {t('shopTomorrow')}
                    </button>
                  ) : null}
                  {laterDays.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChooseDateOpen(true);
                        const first = laterDays[0];
                        setDayOffset(first.offset);
                        setSlotValue(first.slots[0]?.value || null);
                      }}
                      className={`rounded-xl px-2 py-2.5 text-center text-sm font-medium border transition ${
                        dayTab === 'choose'
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {t('shopChooseDate')}
                    </button>
                  ) : null}
                </div>

                {chooseDateOpen && laterDays.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {laterDays.map((d) => (
                      <button
                        key={d.offset}
                        type="button"
                        onClick={() => {
                          setDayOffset(d.offset);
                          setSlotValue(d.slots[0]?.value || null);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${
                          dayOffset === d.offset
                            ? 'bg-amber-100 border-amber-400 text-amber-900'
                            : 'border-stone-200 text-stone-600'
                        }`}
                      >
                        {d.dateLabel} · {d.weekday}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!scheduleDays.length ? (
                  <p className="text-sm text-rose-600 font-medium">{t('shopClosedThisDay')}</p>
                ) : null}

                {channelOpen && dayOffset === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSlotValue(null)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                      slotValue == null
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-stone-700 border-stone-200'
                    }`}
                  >
                    {t('shopAsap')}
                  </button>
                ) : null}

                {!channelOpen && dayOffset === 0 && !activeDay?.slots.length ? (
                  <p className="text-sm font-medium text-rose-600">{t('shopClosedThisDay')}</p>
                ) : null}

                {(activeDay?.slots.length || 0) > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {activeDay?.slots.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSlotValue(s.value)}
                        className={`rounded-xl border py-2 text-sm font-semibold tabular-nums transition ${
                          slotValue === s.value
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-800 border-stone-200 hover:border-amber-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 px-5 py-4 border-t border-stone-100 bg-stone-50/80">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full rounded-xl bg-amber-700 py-3.5 text-sm font-semibold text-white hover:bg-amber-800 transition"
            >
              {resolvedConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
