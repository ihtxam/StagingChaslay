import { useEffect, useState } from 'react';
import axios from 'axios';

export type ShopNavFlags = {
  showGiftCards: boolean;
  showReservations: boolean;
};

const DEFAULT_FLAGS: ShopNavFlags = { showGiftCards: false, showReservations: false };

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
    if (overrides?.showGiftCards !== undefined && overrides?.showReservations !== undefined) {
      return;
    }
    let cancelled = false;
    axios
      .get(`/api/shop/${shopKey}`)
      .then((res) => {
        if (cancelled) return;
        const m = res.data?.data;
        setFetched({
          showGiftCards: !!m?.giftCards?.enabled,
          showReservations: !!m?.reservationsEnabled,
        });
      })
      .catch(() => {
        if (!cancelled) setFetched(DEFAULT_FLAGS);
      });
    return () => {
      cancelled = true;
    };
  }, [shopKey, overrides?.showGiftCards, overrides?.showReservations]);

  return {
    showGiftCards: overrides?.showGiftCards ?? fetched.showGiftCards,
    showReservations: overrides?.showReservations ?? fetched.showReservations,
  };
}
