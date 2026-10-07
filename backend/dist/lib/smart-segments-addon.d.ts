import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isSmartSegmentsAddonEnabled };
export declare const readSmartSegmentsAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeSmartSegmentsAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasSmartSegmentsLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=smart-segments-addon.d.ts.map