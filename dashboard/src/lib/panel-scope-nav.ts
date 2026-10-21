import { shouldShowLocationSwitcher } from '@/lib/pos-hub-visibility';

export type PanelScopeNavInput = {
  locationCount: number;
  maxLocations?: number | null;
  maxPosPosts?: number | null;
  isHqView: boolean;
};

export function isPanelLocationSwitcherActive(input: {
  locationCount: number;
  maxLocations?: number | null;
  maxPosPosts?: number | null;
}): boolean {
  return shouldShowLocationSwitcher({
    locationCount: input.locationCount,
    maxLocations: input.maxLocations,
    maxPosPosts: input.maxPosPosts,
  });
}

/** HQ dashboard, bulk pricing, catalog push — not branch panel routes. */
export function isHqPanelPath(path: string): boolean {
  const normalized = String(path || '')
    .trim()
    .split('?')[0]
    .replace(/\/$/, '');
  if (!normalized) return false;
  return normalized === '/merchant/hq' || normalized.startsWith('/merchant/hq/');
}

/**
 * Multi-location merchants: HQ nav only when HQ is selected in the switcher.
 * Single-location (no switcher): unchanged — HQ section still follows license flags.
 */
export function shouldShowHqPanelNav(
  input: PanelScopeNavInput & { hqNavLicensed: boolean }
): boolean {
  if (!input.hqNavLicensed) return false;
  const switcher = isPanelLocationSwitcherActive(input);
  if (!switcher) return true;
  return input.isHqView;
}

/** Branch panel uses the same location catalog isolation as WebPOS. */
export function shouldUseBranchCatalogPanel(input: PanelScopeNavInput): boolean {
  if (!isPanelLocationSwitcherActive(input)) return false;
  return !input.isHqView;
}

export function panelCatalogListParams(
  input: PanelScopeNavInput
): { posLocationCatalog: '1' } | Record<string, never> {
  return shouldUseBranchCatalogPanel(input) ? { posLocationCatalog: '1' } : {};
}

/** HQ push badges only make sense in HQ overview, not in an isolated branch view. */
export function shouldShowHqCatalogBadges(input: PanelScopeNavInput): boolean {
  if (!isPanelLocationSwitcherActive(input)) return false;
  return input.isHqView;
}

export function shouldRedirectFromHqPanelPath(
  path: string,
  input: PanelScopeNavInput
): boolean {
  if (!isPanelLocationSwitcherActive(input)) return false;
  if (input.isHqView) return false;
  return isHqPanelPath(path);
}

/** POS sidebar shortcut: pick a branch first when HQ aggregate view is active. */
export function shouldShowPanelPosQuickAction(
  input: PanelScopeNavInput & { baseAllowed: boolean }
): boolean {
  if (!input.baseAllowed) return false;
  if (!isPanelLocationSwitcherActive(input)) return true;
  return !input.isHqView;
}
