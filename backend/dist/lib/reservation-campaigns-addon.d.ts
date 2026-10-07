import { isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";
export { isGrowthSkuAddonEnabled as isReservationCampaignsAddonEnabled };
export declare const readReservationCampaignsAddonEnabled: (merchantId: string) => Promise<boolean>;
export declare const writeReservationCampaignsAddonEnabled: (merchantId: string, enabled: boolean) => Promise<boolean>;
export declare const merchantHasReservationCampaignsLicense: (merchantId: string) => Promise<boolean>;
//# sourceMappingURL=reservation-campaigns-addon.d.ts.map