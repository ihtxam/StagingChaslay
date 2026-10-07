import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isMarketingAutomationAddonEnabled };
export declare const readMarketingAutomationAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeMarketingAutomationAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasMarketingAutomationLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=marketing-automation-addon.d.ts.map