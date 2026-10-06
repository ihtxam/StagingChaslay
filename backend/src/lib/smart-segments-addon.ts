import { ensureSmartSegmentsAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "smart_segments_addon_enabled",
  columnCamel: "smartSegmentsAddonEnabled",
  ensureColumn: ensureSmartSegmentsAddonColumn,
});

export { isGrowthSkuAddonEnabled as isSmartSegmentsAddonEnabled };
export const readSmartSegmentsAddonEnabled = api.readEnabled;
export const writeSmartSegmentsAddonEnabled = api.writeEnabled;
export const merchantHasSmartSegmentsLicense = api.merchantHasLicense;
