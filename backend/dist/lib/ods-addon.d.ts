/** Paid order display system (ODS) addon — merchant-level, not edition-gated. */
export declare function isOdsAddonEnabled(value: unknown): boolean;
export declare function readOdsAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeOdsAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function readOdsAddonEnabledMap(merchantIds: string[]): Promise<Map<string, boolean>>;
//# sourceMappingURL=ods-addon.d.ts.map