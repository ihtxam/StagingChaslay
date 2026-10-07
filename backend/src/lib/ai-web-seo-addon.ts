import { ensureAiWebSeoAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "ai_web_seo_addon_enabled",
  columnCamel: "aiWebSeoAddonEnabled",
  ensureColumn: ensureAiWebSeoAddonColumn,
});

export { isGrowthSkuAddonEnabled as isAiWebSeoAddonEnabled };
export const readAiWebSeoAddonEnabled = api.readEnabled;
export const writeAiWebSeoAddonEnabled = api.writeEnabled;
export const merchantHasAiWebSeoLicense = api.merchantHasLicense;
