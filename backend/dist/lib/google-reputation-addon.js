"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasGoogleReputationLicense = exports.writeGoogleReputationAddonEnabled = exports.readGoogleReputationAddonEnabled = exports.isGoogleReputationAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isGoogleReputationAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "google_reputation_addon_enabled",
    columnCamel: "googleReputationAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureGoogleReputationAddonColumn,
});
exports.readGoogleReputationAddonEnabled = api.readEnabled;
exports.writeGoogleReputationAddonEnabled = api.writeEnabled;
exports.merchantHasGoogleReputationLicense = api.merchantHasLicense;
//# sourceMappingURL=google-reputation-addon.js.map