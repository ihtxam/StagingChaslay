"use strict";
/**
 * Restaurant vs retail vertical — single source of truth for module gating.
 * Keep in sync with dashboard/src/lib/business-module.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETAIL_MODULE_ROUTES = exports.RESTAURANT_MODULE_ROUTES = exports.BUSINESS_MODULES = void 0;
exports.normalizeBusinessModule = normalizeBusinessModule;
exports.businessModuleFromEditionCategory = businessModuleFromEditionCategory;
exports.normalizePanelPath = normalizePanelPath;
exports.isRestaurantModule = isRestaurantModule;
exports.isRetailModule = isRetailModule;
exports.canAccessBusinessModuleRoute = canAccessBusinessModuleRoute;
exports.posModeForModule = posModeForModule;
exports.moduleLabel = moduleLabel;
exports.businessModuleMerchantPatch = businessModuleMerchantPatch;
exports.BUSINESS_MODULES = ["restaurant", "retail"];
function normalizeBusinessModule(raw) {
    const v = String(raw || "").trim().toLowerCase();
    if (v === "retail" || v === "restaurant")
        return v;
    return null;
}
/** Edition template category may be broader than a merchant's locked module. */
function businessModuleFromEditionCategory(editionCategory, preferred) {
    const pref = normalizeBusinessModule(preferred);
    if (pref)
        return pref;
    const cat = String(editionCategory || "").trim().toLowerCase();
    if (cat === "retail")
        return "retail";
    if (cat === "restaurant")
        return "restaurant";
    return "restaurant";
}
/** Panel routes visible only in restaurant module. */
exports.RESTAURANT_MODULE_ROUTES = [
    "/merchant/waiter",
    "/merchant/floor-plan",
    "/merchant/tables",
    "/merchant/tables/settings",
    "/merchant/tables/layout",
    "/merchant/tables/qr",
    "/merchant/reservations",
    "/merchant/sales/reservations",
    "/merchant/inventory/cookbook",
    "/merchant/inventory/consumption",
    "/merchant/signage",
];
/** Panel routes visible only in retail module. */
exports.RETAIL_MODULE_ROUTES = ["/merchant/storekeeper"];
function normalizePanelPath(path) {
    const p = String(path || "").replace(/\/$/, "") || "/merchant";
    return p;
}
function isRestaurantModule(module) {
    return module === "restaurant";
}
function isRetailModule(module) {
    return module === "retail";
}
/** null module = legacy / unknown — allow all routes (backward compatible). */
function canAccessBusinessModuleRoute(path, module) {
    if (!module)
        return true;
    const normalized = normalizePanelPath(path);
    if (module === "retail") {
        if (exports.RESTAURANT_MODULE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))) {
            return false;
        }
        return true;
    }
    if (module === "restaurant") {
        if (exports.RETAIL_MODULE_ROUTES.some((r) => normalized === r || normalized.startsWith(`${r}/`))) {
            return false;
        }
        return true;
    }
    return true;
}
function posModeForModule(module) {
    return module === "retail" ? "retail" : "restaurant";
}
function moduleLabel(module) {
    return module === "retail" ? "Retail" : "Restaurant";
}
/** DB patch when locking a merchant to retail or restaurant. */
function businessModuleMerchantPatch(module, prevCheckout) {
    const checkout = prevCheckout && typeof prevCheckout === "object" ? { ...prevCheckout } : {};
    checkout.posMode = posModeForModule(module);
    const patch = {
        businessCategory: module,
        posCheckoutSettings: checkout,
        updatedAt: new Date(),
    };
    if (module === "retail") {
        patch.floorPlanEnabled = false;
        patch.coursesEnabled = false;
        patch.reservationsEnabled = false;
        if (checkout.retailTakeawayEnabled === undefined)
            checkout.retailTakeawayEnabled = true;
        checkout.tablesEnabled = false;
        checkout.requireTableForDineIn = false;
    }
    else {
        if (checkout.tablesEnabled === undefined)
            checkout.tablesEnabled = true;
        if (checkout.requireTableForDineIn === undefined)
            checkout.requireTableForDineIn = true;
    }
    patch.posCheckoutSettings = checkout;
    return patch;
}
//# sourceMappingURL=business-module.js.map