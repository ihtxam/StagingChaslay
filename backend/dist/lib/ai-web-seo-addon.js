"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasAiWebSeoLicense = exports.writeAiWebSeoAddonEnabled = exports.readAiWebSeoAddonEnabled = exports.isAiWebSeoAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isAiWebSeoAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "ai_web_seo_addon_enabled",
    columnCamel: "aiWebSeoAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureAiWebSeoAddonColumn,
});
exports.readAiWebSeoAddonEnabled = api.readEnabled;
exports.writeAiWebSeoAddonEnabled = api.writeEnabled;
exports.merchantHasAiWebSeoLicense = api.merchantHasLicense;
//# sourceMappingURL=ai-web-seo-addon.js.map