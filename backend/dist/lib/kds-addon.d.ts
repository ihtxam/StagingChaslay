/** Paid kitchen display (KDS) addon — merchant-level, not edition-gated. */
export declare function isKdsAddonEnabled(value: unknown): boolean;
export declare function readKdsAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeKdsAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function readKdsAddonEnabledMap(merchantIds: string[]): Promise<Map<string, boolean>>;
//# sourceMappingURL=kds-addon.d.ts.map