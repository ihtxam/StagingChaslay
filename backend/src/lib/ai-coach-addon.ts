import { ensureAiCoachAddonColumn } from "@/lib/ensure-merchant-schema";
import { createGrowthSkuAddon, isGrowthSkuAddonEnabled } from "@/lib/growth-sku-addon-lib";

const api = createGrowthSkuAddon({
  columnSnake: "ai_coach_addon_enabled",
  columnCamel: "aiCoachAddonEnabled",
  ensureColumn: ensureAiCoachAddonColumn,
});

export { isGrowthSkuAddonEnabled as isAiCoachAddonEnabled };
export const readAiCoachAddonEnabled = api.readEnabled;
export const writeAiCoachAddonEnabled = api.writeEnabled;
export const merchantHasAiCoachLicense = api.merchantHasLicense;
