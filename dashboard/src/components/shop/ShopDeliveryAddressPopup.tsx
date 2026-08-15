import ShopChannelPrompt, { type ShopFulfillmentConfirmPayload } from '@/components/shop/ShopChannelPrompt';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  shopKey: string;
  address: string;
  zipCode: string;
  city: string;
  subtotal?: number;
  merchantLat?: number | null;
  merchantLng?: number | null;
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
 * Delivery address confirmation — reuses the unified fulfillment modal (address-only mode).
 */
export default function ShopDeliveryAddressPopup({
  open,
  shopKey,
  address,
  zipCode,
  city,
  subtotal = 0,
  merchantLat,
  merchantLng,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();

  const handleConfirm = (payload: ShopFulfillmentConfirmPayload) => {
    onConfirm({
      address: payload.address || address,
      zipCode: payload.zipCode || zipCode,
      city: payload.city || city,
      lat: payload.lat,
      lng: payload.lng,
      deliveryInfo: payload.deliveryInfo,
    });
  };

  return (
    <ShopChannelPrompt
      open={open}
      addressOnly
      shopKey={shopKey}
      address={address}
      zipCode={zipCode}
      city={city}
      subtotal={subtotal}
      merchantLat={merchantLat}
      merchantLng={merchantLng}
      options={[{ id: 'delivery', label: t('shopDelivery'), etaMinutes: 45, open: true }]}
      selected="delivery"
      onSelect={() => {}}
      onConfirm={handleConfirm}
      onClose={onClose}
      confirmLabel={t('shopConfirmDelivery')}
    />
  );
}
