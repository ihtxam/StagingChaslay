import { ensureGoogleReputationAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "google_reputation_addon_enabled",
  columnCamel: "googleReputationAddonEnabled",
  ensureColumn: ensureGoogleReputationAddonColumn,
});

export { isGrowthSkuAddonEnabled as isGoogleReputationAddonEnabled };
export const readGoogleReputationAddonEnabled = api.readEnabled;
export const writeGoogleReputationAddonEnabled = api.writeEnabled;
export const merchantHasGoogleReputationLicense = api.merchantHasLicense;
