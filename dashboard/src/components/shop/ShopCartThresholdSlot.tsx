import ShopCartThresholdProgress from '@/components/shop/ShopCartThresholdProgress';
import { pickCartThresholdBar } from '@/lib/shop-cart-threshold';

type Props = {
  channel?: string | null;
  subtotal: number;
  minOrder?: number | string | null;
  freeDeliveryFrom?: number | string | null;
  className?: string;
};

/** One delivery progress bar: minimum order first, then free delivery. */
export default function ShopCartThresholdSlot({
  channel,
  subtotal,
  minOrder,
  freeDeliveryFrom,
  className = '',
}: Props) {
  const bar = pickCartThresholdBar({ channel, subtotal, minOrder, freeDeliveryFrom });
  if (!bar) return null;

  if (bar.kind === 'min') {
    return (
      <ShopCartThresholdProgress
        subtotal={subtotal}
        threshold={bar.threshold}
        progressKey="shopMinOrderProgress"
        unlockedKey="shopMinOrderUnlocked"
        remainingKey="shopMinOrderRemaining"
        variant="min"
        className={className}
      />
    );
  }

  return (
    <ShopCartThresholdProgress
      subtotal={subtotal}
      threshold={bar.threshold}
      progressKey="shopFreeDeliveryProgress"
      unlockedKey="shopFreeDeliveryUnlocked"
      remainingKey="shopMinOrderRemaining"
      variant="free"
      className={className}
    />
  );
}
