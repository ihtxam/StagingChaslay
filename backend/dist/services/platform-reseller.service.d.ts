export declare const PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";
export declare class PlatformResellerService {
    /** Reseller id used for direct Reborn → merchant sales (superadmin acts as this agency). */
    static getId(): Promise<string>;
    static ensure(): Promise<string>;
    /** Selling reseller for a merchant: assigned agency or platform direct. */
    static resolveForMerchant(merchantId: string): Promise<string>;
    /** Migrate legacy platform-owned packages/add-ons to the platform reseller. */
    static migrateCatalogOwnership(): Promise<void>;
}
//# sourceMappingURL=platform-reseller.service.d.ts.map