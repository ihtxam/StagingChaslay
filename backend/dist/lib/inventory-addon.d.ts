/** Paid restaurant inventory + recipes addon (merchant-level, not edition-gated). */
export declare function isInventoryAddonEnabled(value: unknown): boolean;
/** Read the paid-addon column via SQL so a stale Drizzle mapping cannot hide a true flag. */
export declare function readInventoryAddonEnabled(merchantId: string): Promise<boolean>;
/** Persist the paid-addon column via SQL (source of truth for Superadmin / reseller toggles). */
export declare function writeInventoryAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function readInventoryAddonEnabledMap(merchantIds: string[]): Promise<Map<string, boolean>>;
//# sourceMappingURL=inventory-addon.d.ts.map