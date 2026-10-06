import { ensureReservationCampaignsAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "reservation_campaigns_addon_enabled",
  columnCamel: "reservationCampaignsAddonEnabled",
  ensureColumn: ensureReservationCampaignsAddonColumn,
});

export { isGrowthSkuAddonEnabled as isReservationCampaignsAddonEnabled };
export const readReservationCampaignsAddonEnabled = api.readEnabled;
export const writeReservationCampaignsAddonEnabled = api.writeEnabled;
export const merchantHasReservationCampaignsLicense = api.merchantHasLicense;
