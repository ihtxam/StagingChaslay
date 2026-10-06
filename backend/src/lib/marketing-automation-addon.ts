import { ensureMarketingAutomationAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "marketing_automation_addon_enabled",
  columnCamel: "marketingAutomationAddonEnabled",
  ensureColumn: ensureMarketingAutomationAddonColumn,
});

export { isGrowthSkuAddonEnabled as isMarketingAutomationAddonEnabled };
export const readMarketingAutomationAddonEnabled = api.readEnabled;
export const writeMarketingAutomationAddonEnabled = api.writeEnabled;
export const merchantHasMarketingAutomationLicense = api.merchantHasLicense;
