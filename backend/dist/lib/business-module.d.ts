/**
 * Restaurant vs retail vertical — single source of truth for module gating.
 * Keep in sync with dashboard/src/lib/business-module.ts
 */
export type BusinessModule = "retail" | "restaurant";
export declare const BUSINESS_MODULES: BusinessModule[];
export declare function normalizeBusinessModule(raw?: string | null): BusinessModule | null;
/** Edition template category may be broader than a merchant's locked module. */
export declare function businessModuleFromEditionCategory(editionCategory?: string | null, preferred?: BusinessModule | null): BusinessModule;
/** Panel routes visible only in restaurant module. */
export declare const RESTAURANT_MODULE_ROUTES: string[];
/** Panel routes visible only in retail module. */
export declare const RETAIL_MODULE_ROUTES: string[];
export declare function normalizePanelPath(path: string): string;
export declare function isRestaurantModule(module?: BusinessModule | null): boolean;
export declare function isRetailModule(module?: BusinessModule | null): boolean;
/** null module = legacy / unknown — allow all routes (backward compatible). */
export declare function canAccessBusinessModuleRoute(path: string, module?: BusinessModule | null): boolean;
export declare function posModeForModule(module: BusinessModule): "retail" | "restaurant";
export declare function moduleLabel(module: BusinessModule): string;
/** DB patch when locking a merchant to retail or restaurant. */
export declare function businessModuleMerchantPatch(module: BusinessModule, prevCheckout?: Record<string, unknown> | null): Record<string, unknown>;
//# sourceMappingURL=business-module.d.ts.map