import { displaySidebarShopName } from '@/lib/brand';
import { shouldShowLocationSwitcher } from '@/lib/pos-hub-visibility';
import type { MerchantLocation } from '@/store/location';

export type PanelLocationHeaderInput = {
  merchantName: string;
  locationCount: number;
  maxLocations?: number | null;
  isHqView: boolean;
  location: Pick<MerchantLocation, 'name' | 'businessCategory'> | null;
};

export type PanelLocationHeaderLabels = {
  /** Large primary line in compact header / sidebar */
  primary: string;
  /** Merchant org name when a branch is selected */
  secondary: string | null;
  showHqBadge: boolean;
  /** Retail / Restaurant when viewing a branch */
  scopeTag: string | null;
};

export function formatLocationBusinessCategory(category: string | null | undefined): string | null {
  const c = String(category || '').trim().toLowerCase();
  if (!c) return null;
  if (c === 'retail') return 'Retail';
  if (c === 'restaurant') return 'Restaurant';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function buildPanelLocationHeaderLabels(
  input: PanelLocationHeaderInput
): PanelLocationHeaderLabels {
  const merchant = displaySidebarShopName(input.merchantName.trim());
  const switcherOn = shouldShowLocationSwitcher({
    locationCount: input.locationCount,
    maxLocations: input.maxLocations,
  });

  if (!switcherOn || !merchant) {
    return {
      primary: merchant,
      secondary: null,
      showHqBadge: false,
      scopeTag: null,
    };
  }

  if (input.isHqView) {
    return {
      primary: merchant,
      secondary: null,
      showHqBadge: true,
      scopeTag: null,
    };
  }

  const branchName = input.location?.name?.trim() || merchant;
  return {
    primary: branchName,
    secondary: merchant !== branchName ? merchant : null,
    showHqBadge: false,
    scopeTag: formatLocationBusinessCategory(input.location?.businessCategory),
  };
}
