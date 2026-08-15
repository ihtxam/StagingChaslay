import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ZipCityFields from '@/components/shop/ZipCityFields';
import { useI18n } from '@/lib/i18n';
import { withDeliveryMinOrderStatus } from '@/lib/shop-delivery';

type Props = {
  open: boolean;
  shopKey: string;
  address: string;
  zipCode: string;
  city: string;
  subtotal?: number;
  onClose: () => void;
  onConfirm: (payload: {
    address: string;
    zipCode: string;
    city: string;
    lat?: number;
    lng?: number;
    deliveryInfo: any;
  }) => void;
};

/**
 * Modal to confirm delivery address before proceeding with a delivery order.
 */
export default function ShopDeliveryAddressPopup({
  open,
  shopKey,
  address: initialAddress,
  zipCode: initialZip,
  city: initialCity,
  subtotal = 0,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [address, setAddress] = useState(initialAddress);
  const [zipCode, setZipCode] = useState(initialZip);
  const [city, setCity] = useState(initialCity);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    setAddress(initialAddress);
    setZipCode(initialZip);
    setCity(initialCity);
    setError(null);
    setDeliveryInfo(null);
    setLat(undefined);
    setLng(undefined);
  }, [open, initialAddress, initialZip, initialCity]);

  const effectiveDeliveryInfo = useMemo(
    () => withDeliveryMinOrderStatus(deliveryInfo, subtotal),
    [deliveryInfo, subtotal]
  );

  if (!open) return null;

  const verify = async () => {
    if (!address.trim()) {
      setError(t('shopEnterDeliveryAddress'));
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, {
        query: `${address}, ${zipCode} ${city} Switzerland`,
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
      const live = withDeliveryMinOrderStatus(res.data, subtotal);
      if (!res.data.deliverable) {
        setError(res.data.error || t('shopOutsideDelivery'));
        return;
      }
      if (!live.meetsMinOrder) {
        setError(live.message || t('shopMinOrderNotMet'));
      }
    } catch (e: any) {
      setError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      setDeliveryInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const confirm = () => {
    if (!address.trim()) {
      setError(t('shopEnterDeliveryAddress'));
      return;
    }
    if (!effectiveDeliveryInfo?.deliverable) {
      setError(t('shopConfirmDeliveryVerifyFirst'));
      return;
    }
    if (!effectiveDeliveryInfo.meetsMinOrder) {
      setError(effectiveDeliveryInfo.message || t('shopMinOrderNotMet'));
      return;
    }
    onConfirm({ address, zipCode, city, lat, lng, deliveryInfo: effectiveDeliveryInfo });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/45"
        aria-label={t('shopClose')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl px-4 pt-3 pb-5 space-y-4 max-h-[92dvh] overflow-y-auto"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 text-sm font-bold"
          aria-label={t('shopClose')}
        >
          ×
        </button>

        <div className="pr-8">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">
            {t('shopConfirmDeliveryTitle')}
          </h2>
          <p className="mt-1 text-sm text-stone-500 leading-snug">{t('shopConfirmDeliveryHint')}</p>
        </div>

        <div className="space-y-2">
          <input
            className="w-full border border-stone-300 px-3 py-2 text-sm rounded-lg"
            placeholder={t('shopStreetAddressRequired')}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setDeliveryInfo(null);
              setError(null);
            }}
          />
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
            zipClassName="w-full border border-stone-300 px-3 py-2 text-sm rounded-lg"
            cityClassName="w-full border border-stone-300 px-3 py-2 text-sm rounded-lg"
          />
          <button
            type="button"
            onClick={() => void verify()}
            className="w-full border border-stone-900 text-sm font-semibold py-2.5 rounded-lg"
            disabled={checking}
          >
            {checking ? t('shopChecking') : t('shopCheckDeliveryZone')}
          </button>
          {effectiveDeliveryInfo?.deliverable ? (
            <p className={`text-xs ${effectiveDeliveryInfo.meetsMinOrder ? 'text-teal-800' : 'text-amber-800'}`}>
              {effectiveDeliveryInfo.zone.name}: {t('shopFee')} CHF{' '}
              {Number(effectiveDeliveryInfo.zone.deliveryFee).toFixed(2)}
              {effectiveDeliveryInfo.zone.minOrderAmount > 0
                ? ` · ${t('shopMin')} CHF ${Number(effectiveDeliveryInfo.zone.minOrderAmount).toFixed(2)}`
                : ''}
              {!effectiveDeliveryInfo.meetsMinOrder && effectiveDeliveryInfo.message
                ? ` · ${effectiveDeliveryInfo.message}`
                : ''}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-stone-300 py-3 text-sm font-semibold text-stone-700"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="flex-1 rounded-xl bg-amber-700 py-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-40"
            disabled={!effectiveDeliveryInfo?.deliverable || !effectiveDeliveryInfo?.meetsMinOrder}
          >
            {t('shopConfirmDelivery')}
          </button>
        </div>
      </div>
    </div>
  );
}
