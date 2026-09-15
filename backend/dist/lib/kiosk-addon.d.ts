/** Paid self-order kiosk addon — merchant-level. */
export declare function isKioskAddonEnabled(value: unknown): boolean;
export declare function readKioskAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeKioskAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function readKioskAddonEnabledMap(merchantIds: string[]): Promise<Map<string, boolean>>;
//# sourceMappingURL=kiosk-addon.d.ts.map