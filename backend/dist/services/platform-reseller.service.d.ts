export declare const PLATFORM_RESELLER_SETTINGS_KEY = "platform_reseller_id";
export declare class PlatformResellerService {
    /** Reseller id used when a merchant has no assigned agency (defaults to Chaslay). */
    static getId(): Promise<string>;
    /** Ensure Chaslay agency exists and is the platform default seller (no direct Reborn sales). */
    static ensure(): Promise<string>;
    /** Selling reseller for a merchant: assigned agency or Chaslay default. */
    static resolveForMerchant(merchantId: string): Promise<string>;
    /** Move legacy Reborn Direct catalog and merchants to Chaslay agency. */
    static migrateLegacyDirectSalesCatalog(chaslayId: string): Promise<void>;
    /** Migrate legacy platform-owned packages/add-ons to the Chaslay reseller. */
    static migrateCatalogOwnership(): Promise<void>;
}
//# sourceMappingURL=platform-reseller.service.d.ts.map