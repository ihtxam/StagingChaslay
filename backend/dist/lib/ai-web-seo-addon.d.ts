import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isAiWebSeoAddonEnabled };
export declare const readAiWebSeoAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeAiWebSeoAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasAiWebSeoLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=ai-web-seo-addon.d.ts.map