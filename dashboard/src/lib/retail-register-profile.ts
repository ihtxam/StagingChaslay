import type { CartSide, RetailTileSize } from '@/lib/pos-checkout';

export type RetailRegisterProfile = {
  id: string;
  name: string;
  cartSide: CartSide;
  retailTileSize: RetailTileSize;
  retailScannerFirst: boolean;
  retailPaymentBar: boolean;
  retailShowStockOnTiles: boolean;
  retailQuickTiles: string[];
};

export const REGISTER_PROFILE_LS = 'webpos_retail_register_profile_id';

export function parseRetailRegisterProfiles(raw: unknown): RetailRegisterProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      const o = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
      const tiles = Array.isArray(o.retailQuickTiles)
        ? o.retailQuickTiles.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 24)
        : [];
      return {
        id: String(o.id || `reg-${i + 1}`).trim().slice(0, 40) || `reg-${i + 1}`,
        name: String(o.name || `Register ${i + 1}`).trim().slice(0, 40) || `Register ${i + 1}`,
        cartSide: o.cartSide === 'left' ? 'left' : 'right',
        retailTileSize:
          o.retailTileSize === 'sm' || o.retailTileSize === 'md' || o.retailTileSize === 'lg'
            ? o.retailTileSize
            : 'lg',
        retailScannerFirst: o.retailScannerFirst !== false,
        retailPaymentBar: o.retailPaymentBar !== false,
        retailShowStockOnTiles: o.retailShowStockOnTiles === true,
        retailQuickTiles: tiles,
      } satisfies RetailRegisterProfile;
    })
    .slice(0, 12);
}

export function readDeviceRegisterProfileId(): string | null {
  try {
    const id = localStorage.getItem(REGISTER_PROFILE_LS);
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export function writeDeviceRegisterProfileId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(REGISTER_PROFILE_LS);
    else localStorage.setItem(REGISTER_PROFILE_LS, id);
  } catch {
    /* ignore */
  }
}

export function profileLayoutPatch(profile: RetailRegisterProfile): {
  cartSide: CartSide;
  retailTileSize: RetailTileSize;
  retailScannerFirst: boolean;
  retailPaymentBar: boolean;
  retailShowStockOnTiles: boolean;
  retailQuickTiles: string[];
} {
  return {
    cartSide: profile.cartSide,
    retailTileSize: profile.retailTileSize,
    retailScannerFirst: profile.retailScannerFirst,
    retailPaymentBar: profile.retailPaymentBar,
    retailShowStockOnTiles: profile.retailShowStockOnTiles,
    retailQuickTiles: profile.retailQuickTiles,
  };
}
