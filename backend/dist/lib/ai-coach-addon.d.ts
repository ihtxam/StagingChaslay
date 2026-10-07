import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isAiCoachAddonEnabled };
export declare const readAiCoachAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeAiCoachAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasAiCoachLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=ai-coach-addon.d.ts.map