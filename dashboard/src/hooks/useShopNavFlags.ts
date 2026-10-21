import { useEffect, useState } from 'react';
import axios from 'axios';

export type ShopNavFlags = {
  showGiftCards: boolean;
  showReservations: boolean;
  showCatering: boolean;
};

const DEFAULT_FLAGS: ShopNavFlags = {
  showGiftCards: false,
  showReservations: false,
  showCatering: false,
};

/** Load gift-card / reservation flags for shop topbar when caller has no merchant payload. */
export function useShopNavFlags(
  shopKey?: string | null,
  overrides?: Partial<ShopNavFlags>
): ShopNavFlags {
  const [fetched, setFetched] = useState<ShopNavFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    if (!shopKey) {
      setFetched(DEFAULT_FLAGS);
      return;
    }
    if (
      overrides?.showGiftCards !== undefined &&
      overrides?.showReservations !== undefined &&
      overrides?.showCatering !== undefined
    ) {
      return;
    }
    let cancelled = false;
    Promise.all([
      axios.get(`/api/shop/${shopKey}`),
      axios.get(`/api/shop/${shopKey}/locations`).catch(() => ({ data: {} })),
      axios.get(`/api/shop/${shopKey}/reservations/config`).catch(() => null),
    ])
      .then(([shopRes, locRes, reservationsRes]) => {
        if (cancelled) return;
        const m = shopRes.data?.data;
        const reservationsLive =
          !!m?.reservationsEnabled &&
          !!reservationsRes?.data?.config?.enabled;
        setFetched({
          showGiftCards: !!m?.giftCards?.enabled,
          showReservations: reservationsLive,
          showCatering:
            overrides?.showCatering ??
            (!!m?.cateringEnabled && !!locRes.data?.hasCatering),
        });
      })
      .catch(() => {
        if (!cancelled) setFetched(DEFAULT_FLAGS);
      });
    return () => {
      cancelled = true;
    };
  }, [shopKey, overrides?.showGiftCards, overrides?.showReservations, overrides?.showCatering]);

  return {
    showGiftCards: overrides?.showGiftCards ?? fetched.showGiftCards,
    showReservations: overrides?.showReservations ?? fetched.showReservations,
    showCatering: overrides?.showCatering ?? fetched.showCatering,
  };
}
