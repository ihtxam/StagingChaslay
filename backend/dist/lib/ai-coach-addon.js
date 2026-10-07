"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasAiCoachLicense = exports.writeAiCoachAddonEnabled = exports.readAiCoachAddonEnabled = exports.isAiCoachAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isAiCoachAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "ai_coach_addon_enabled",
    columnCamel: "aiCoachAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureAiCoachAddonColumn,
});
exports.readAiCoachAddonEnabled = api.readEnabled;
exports.writeAiCoachAddonEnabled = api.writeEnabled;
exports.merchantHasAiCoachLicense = api.merchantHasLicense;
//# sourceMappingURL=ai-coach-addon.js.map