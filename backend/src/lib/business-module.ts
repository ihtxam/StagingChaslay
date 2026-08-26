/**
 * Restaurant vs retail vertical — single source of truth for module gating.
 * Keep in sync with dashboard/src/lib/business-module.ts
 */

export type BusinessModule = "retail" | "restaurant";

export const BUSINESS_MODULES: BusinessModule[] = ["restaurant", "retail"];

export function normalizeBusinessModule(raw?: string | null): BusinessModule | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "retail" || v === "restaurant") return v;
  return null;
}

/** Edition template category may be broader than a merchant's locked module. */
export function businessModuleFromEditionCategory(
  editionCategory?: string | null,
  preferred?: BusinessModule | null
): BusinessModule {
  const pref = normalizeBusinessModule(preferred);
  if (pref) return pref;
  const cat = String(editionCategory || "").trim().toLowerCase();
  if (cat === "retail") return "retail";
  if (cat === "restaurant") return "restaurant";
  return "restaurant";
}

/** Panel routes visible only in restaurant module. */
export const RESTAURANT_MODULE_ROUTES: string[] = [
  "/merchant/waiter",
  "/merchant/floor-plan",
  "/merchant/tables",
  "/merchant/tables/settings",
  "/merchant/tables/layout",
  "/merchant/tables/qr",
  "/merchant/reservations",
  "/merchant/sales/reservations",
  "/merchant/signage",
];

/** Panel routes visible only in retail module. */
export const RETAIL_MODULE_ROUTES: string[] = [
  "/merchant/storekeeper",
  "/merchant/inventory",
];

/** Retail inventory — stock only; no recipes or consumption reports. */
export const RETAIL_INVENTORY_RECIPE_ROUTES: string[] = [
  "/merchant/inventory/cookbook",
  "/merchant/inventory/consumption",
];

export function normalizePanelPath(path: string): string {
  const p = String(path || "").replace(/\/$/, "") || "/merchant";
  return p;
}

export function isRestaurantModule(module?: BusinessModule | null): boolean {
  return module === "restaurant";
}

export function isRetailModule(module?: BusinessModule | null): boolean {
  return module === "retail";
}

/** null module = legacy / unknown — allow all routes (backward compatible). */
export function canAccessBusinessModuleRoute(
  path: string,
  module?: BusinessModule | null
): boolean {
  if (!module) return true;
  const normalized = normalizePanelPath(path);
  if (module === "retail") {
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
  if (module === "restaurant") {
    if (RETAIL_MODULE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))) {
      return false;
    }
    return true;
  }
  return true;
}

export function posModeForModule(module: BusinessModule): "retail" | "restaurant" {
  return module === "retail" ? "retail" : "restaurant";
}

export function moduleLabel(module: BusinessModule): string {
  return module === "retail" ? "Retail" : "Restaurant";
}

/** DB patch when locking a merchant to retail or restaurant. */
export function businessModuleMerchantPatch(
  module: BusinessModule,
  prevCheckout?: Record<string, unknown> | null
): Record<string, unknown> {
  const checkout =
    prevCheckout && typeof prevCheckout === "object" ? { ...prevCheckout } : {};
  checkout.posMode = posModeForModule(module);
  const patch: Record<string, unknown> = {
    businessCategory: module,
    posCheckoutSettings: checkout,
    updatedAt: new Date(),
  };
  if (module === "retail") {
    patch.floorPlanEnabled = false;
    patch.coursesEnabled = false;
    patch.reservationsEnabled = false;
    if (checkout.retailTakeawayEnabled === undefined) checkout.retailTakeawayEnabled = true;
    checkout.tablesEnabled = false;
    checkout.requireTableForDineIn = false;
  } else {
    if (checkout.tablesEnabled === undefined) checkout.tablesEnabled = true;
    if (checkout.requireTableForDineIn === undefined) checkout.requireTableForDineIn = true;
  }
  patch.posCheckoutSettings = checkout;
  return patch;
}
