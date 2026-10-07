"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasMarketingAutomationLicense = exports.writeMarketingAutomationAddonEnabled = exports.readMarketingAutomationAddonEnabled = exports.isMarketingAutomationAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isMarketingAutomationAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "marketing_automation_addon_enabled",
    columnCamel: "marketingAutomationAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureMarketingAutomationAddonColumn,
});
exports.readMarketingAutomationAddonEnabled = api.readEnabled;
exports.writeMarketingAutomationAddonEnabled = api.writeEnabled;
exports.merchantHasMarketingAutomationLicense = api.merchantHasLicense;
//# sourceMappingURL=marketing-automation-addon.js.map