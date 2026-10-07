import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isGoogleReputationAddonEnabled };
export declare const readGoogleReputationAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeGoogleReputationAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasGoogleReputationLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=google-reputation-addon.d.ts.map