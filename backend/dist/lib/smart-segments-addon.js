"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasSmartSegmentsLicense = exports.writeSmartSegmentsAddonEnabled = exports.readSmartSegmentsAddonEnabled = exports.isSmartSegmentsAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isSmartSegmentsAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "smart_segments_addon_enabled",
    columnCamel: "smartSegmentsAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureSmartSegmentsAddonColumn,
});
exports.readSmartSegmentsAddonEnabled = api.readEnabled;
exports.writeSmartSegmentsAddonEnabled = api.writeEnabled;
exports.merchantHasSmartSegmentsLicense = api.merchantHasLicense;
//# sourceMappingURL=smart-segments-addon.js.map