import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapPin, Store, UtensilsCrossed, X } from 'lucide-react';
import ShopAddressAutocomplete from '@/components/shop/ShopAddressAutocomplete';
import { useI18n } from '@/lib/i18n';
import { SHOP_BTN_PRIMARY_CLASS, SHOP_INPUT_CLASS } from '@/lib/shop-input';
import type { ShopChannel } from '@/lib/shop-cart';
import {
  saveShopLocationSession,
  type ShopOrderMode,
  type ShopPublicLocation,
} from '@/lib/shop-location-session';
import { withDeliveryMinOrderStatus } from '@/lib/shop-delivery';

type Props = {
  shopKey: string;
  locations: ShopPublicLocation[];
  /** When opening a direct store link, skip the store list step. */
  fixedLocationSlug?: string | null;
  merchantHasCatering?: boolean;
  onComplete: (location: ShopPublicLocation) => void;
  onClose?: () => void;
};

type Step = 'fulfillment' | 'delivery' | 'location' | 'orderType';

export default function ShopLocationHubWizard({
  shopKey,
  locations,
  fixedLocationSlug,
  merchantHasCatering = false,
  onComplete,
  onClose,
}: Props) {
  const { t } = useI18n();
  const fixedLoc = useMemo(
    () => locations.find((l) => l.slug === fixedLocationSlug) || null,
    [locations, fixedLocationSlug]
  );

  const [step, setStep] = useState<Step>(() =>
    fixedLoc ? 'fulfillment' : locations.length === 1 ? 'fulfillment' : 'fulfillment'
  );
  const [channel, setChannel] = useState<ShopChannel>('takeaway');
  const [street, setStreet] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<ShopPublicLocation | null>(
    fixedLoc || (locations.length === 1 ? locations[0]! : null)
  );
  const [addressQuery, setAddressQuery] = useState('');

  const showCateringChoice = useMemo(() => {
    if (!merchantHasCatering) return false;
    if (selectedLoc?.hasCatering === false) return false;
    return true;
  }, [merchantHasCatering, selectedLoc]);

  const filteredLocations = useMemo(() => {
    const q = addressQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => {
      const blob = [l.name, l.address, l.city, l.slug].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [locations, addressQuery]);

  const goOrderTypeOrFinish = useCallback(
    (loc: ShopPublicLocation, mode: ShopOrderMode) => {
      saveShopLocationSession(shopKey, {
        locationSlug: loc.slug,
        locationName: loc.name,
        channel,
        orderMode: mode,
        fulfillmentConfirmed: true,
        address: channel === 'delivery' ? street : undefined,
        zipCode: channel === 'delivery' ? zipCode : undefined,
        city: channel === 'delivery' ? city : undefined,
        deliveryInfo: channel === 'delivery' ? deliveryInfo : undefined,
      });
      onComplete(loc);
    },
    [shopKey, channel, street, zipCode, city, deliveryInfo, onComplete]
  );

  const verifyDelivery = async () => {
    if (!street.trim()) {
      setDeliveryError(t('shopEnterDeliveryAddress'));
      return false;
    }
    setChecking(true);
    setDeliveryError(null);
    try {
      const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, {
        query: [street, zipCode, city].filter(Boolean).join(', '),
      });
      const lat = geoRes.data.found ? Number(geoRes.data.lat) : undefined;
      const lng = geoRes.data.found ? Number(geoRes.data.lng) : undefined;
      const res = await axios.post(`/api/shop/${shopKey}/check-delivery`, {
        lat,
        lng,
        zipCode,
        subtotal: 0,
      });
      const verified = withDeliveryMinOrderStatus(res.data, 0);
      setDeliveryInfo(verified);
      if (!verified.deliverable) {
        setDeliveryError(verified.error || t('shopOutsideDelivery'));
        return false;
      }
      return true;
    } catch (e: any) {
      setDeliveryError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      return false;
    } finally {
      setChecking(false);
    }
  };

  const finishLocation = (loc: ShopPublicLocation) => {
    setSelectedLoc(loc);
    if (!merchantHasCatering || loc.hasCatering === false) {
      goOrderTypeOrFinish(loc, 'menu');
      return;
    }
    setStep('orderType');
  };

  const afterFulfillment = () => {
    if (channel === 'delivery') {
      setStep('delivery');
      return;
    }
    if (fixedLoc || locations.length === 1) {
      finishLocation(fixedLoc || locations[0]!);
      return;
    }
    setStep('location');
  };

  const stepTitle = () => {
    if (step === 'fulfillment') return t('shopHubChooseFulfillment');
    if (step === 'delivery') return t('shopHubDeliveryAddress');
    if (step === 'location') return t('shopHubChooseStore');
    return t('shopHubChooseOrderType');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-900/60 p-0 sm:items-center sm:p-4">
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">{stepTitle()}</h2>
            <p className="mt-0.5 text-xs text-stone-500">{t('shopHubWizardHint')}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-stone-500 hover:bg-stone-100"
              aria-label={t('close')}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'fulfillment' ? (
            <div className="space-y-4">
              <div className="inline-flex w-full rounded-full bg-stone-100 p-1 gap-1">
                {(
                  [
                    { id: 'takeaway' as ShopChannel, label: t('shopPickup') },
                    { id: 'delivery' as ShopChannel, label: t('shopDelivery') },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChannel(opt.id)}
                    className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
                      channel === opt.id
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-stone-600">{t('shopHubFulfillmentBody')}</p>
            </div>
          ) : null}

          {step === 'delivery' ? (
            <div className="space-y-3">
              <ShopAddressAutocomplete
                shopKey={shopKey}
                value={street}
                className={SHOP_INPUT_CLASS}
                onChange={setStreet}
                onPick={(s) => {
                  setStreet(s.street || s.displayAddress.split(',')[0] || street);
                  if (s.postcode) setZipCode(s.postcode);
                  if (s.city) setCity(s.city);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={SHOP_INPUT_CLASS}
                  placeholder={t('deliveryZipCode')}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
                <input
                  className={SHOP_INPUT_CLASS}
                  placeholder={t('city')}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              {deliveryError ? <p className="text-sm text-red-600">{deliveryError}</p> : null}
            </div>
          ) : null}

          {step === 'location' ? (
            <div className="space-y-3">
              <input
                className={SHOP_INPUT_CLASS}
                placeholder={t('shopHubSearchStores')}
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
              />
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {filteredLocations.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-stone-50"
                      onClick={() => finishLocation(loc)}
                    >
                      <Store className="mt-0.5 h-5 w-5 shrink-0 text-stone-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-stone-900">{loc.name}</span>
                        <span className="block text-xs text-stone-500">
                          {[loc.address, loc.city].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      <MapPin className="h-4 w-4 shrink-0 text-stone-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === 'orderType' && selectedLoc && showCateringChoice ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-800">{selectedLoc.name}</p>
              <button
                type="button"
                className={`w-full rounded-xl border-2 px-4 py-4 text-left transition hover:border-stone-900 ${SHOP_BTN_PRIMARY_CLASS}`}
                onClick={() => goOrderTypeOrFinish(selectedLoc, 'menu')}
              >
                <span className="block text-base font-bold">{t('shopHubOrderOnline')}</span>
                <span className="mt-1 block text-sm opacity-90">{t('shopHubOrderOnlineHint')}</span>
              </button>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-4 text-left text-rose-950 transition hover:border-rose-400"
                onClick={() => goOrderTypeOrFinish(selectedLoc, 'catering')}
              >
                <span className="flex items-center gap-2 text-base font-bold">
                  <UtensilsCrossed size={18} />
                  {t('shopHubOrderCatering')}
                </span>
                <span className="mt-1 block text-sm text-rose-900/80">{t('shopHubOrderCateringHint')}</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-stone-100 px-5 py-4">
          {step === 'fulfillment' ? (
            <button type="button" className={`w-full ${SHOP_BTN_PRIMARY_CLASS} py-3`} onClick={afterFulfillment}>
              {t('shopContinue')}
            </button>
          ) : null}
          {step === 'delivery' ? (
            <button
              type="button"
              className={`w-full ${SHOP_BTN_PRIMARY_CLASS} py-3 disabled:opacity-50`}
              disabled={checking}
              onClick={async () => {
                const ok = await verifyDelivery();
                if (!ok) return;
                if (fixedLoc || locations.length === 1) {
                  finishLocation(fixedLoc || locations[0]!);
                } else {
                  setStep('location');
                }
              }}
            >
              {checking ? t('shopChecking') : t('shopContinue')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
