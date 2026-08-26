/**
 * Restaurant vs retail vertical — keep in sync with backend/src/lib/business-module.ts
 */

export type BusinessModule = 'retail' | 'restaurant';

export const BUSINESS_MODULES: BusinessModule[] = ['restaurant', 'retail'];

export function normalizeBusinessModule(raw?: string | null): BusinessModule | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'retail' || v === 'restaurant') return v;
  return null;
}

export function businessModuleFromEditionCategory(
  editionCategory?: string | null,
  preferred?: BusinessModule | null
): BusinessModule {
  const pref = normalizeBusinessModule(preferred);
  if (pref) return pref;
  const cat = String(editionCategory || '').trim().toLowerCase();
  if (cat === 'retail') return 'retail';
  if (cat === 'restaurant') return 'restaurant';
  return 'restaurant';
}

export const RESTAURANT_MODULE_ROUTES: string[] = [
  '/merchant/waiter',
  '/merchant/floor-plan',
  '/merchant/tables',
  '/merchant/tables/settings',
  '/merchant/tables/layout',
  '/merchant/tables/qr',
  '/merchant/reservations',
  '/merchant/sales/reservations',
  '/merchant/signage',
];

export const RETAIL_MODULE_ROUTES: string[] = [
  '/merchant/storekeeper',
  '/merchant/inventory',
];

export const RETAIL_INVENTORY_RECIPE_ROUTES: string[] = [
  '/merchant/inventory/cookbook',
  '/merchant/inventory/consumption',
];

export function normalizePanelPath(path: string): string {
  const p = String(path || '').replace(/\/$/, '') || '/merchant';
  return p;
}

export function isRestaurantModule(module?: BusinessModule | null): boolean {
  return module === 'restaurant';
}

export function isRetailModule(module?: BusinessModule | null): boolean {
  return module === 'retail';
}

export function canAccessBusinessModuleRoute(
  path: string,
  module?: BusinessModule | null
): boolean {
  if (!module) return true;
  const normalized = normalizePanelPath(path);
  if (module === 'retail') {
    if (RESTAURANT_MODULE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))) {
      return false;
    }
    if (
      RETAIL_INVENTORY_RECIPE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))
    ) {
      return false;
    }
    return true;
  }
  if (module === 'restaurant') {
    if (RETAIL_MODULE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))) {
      return false;
    }
    return true;
  }
  return true;
}

export function posModeForModule(module: BusinessModule): 'retail' | 'restaurant' {
  return module === 'retail' ? 'retail' : 'restaurant';
}

export function moduleLabelKey(module: BusinessModule): string {
  return module === 'retail' ? 'businessModuleRetail' : 'businessModuleRestaurant';
}
