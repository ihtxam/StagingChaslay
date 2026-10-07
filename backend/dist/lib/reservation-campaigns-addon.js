"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantHasReservationCampaignsLicense = exports.writeReservationCampaignsAddonEnabled = exports.readReservationCampaignsAddonEnabled = exports.isReservationCampaignsAddonEnabled = void 0;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const growth_sku_addon_lib_1 = require("@/lib/growth-sku-addon-lib");
Object.defineProperty(exports, "isReservationCampaignsAddonEnabled", { enumerable: true, get: function () { return growth_sku_addon_lib_1.isGrowthSkuAddonEnabled; } });
const api = (0, growth_sku_addon_lib_1.createGrowthSkuAddon)({
    columnSnake: "reservation_campaigns_addon_enabled",
    columnCamel: "reservationCampaignsAddonEnabled",
    ensureColumn: ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn,
});
exports.readReservationCampaignsAddonEnabled = api.readEnabled;
exports.writeReservationCampaignsAddonEnabled = api.writeEnabled;
exports.merchantHasReservationCampaignsLicense = api.merchantHasLicense;
//# sourceMappingURL=reservation-campaigns-addon.js.map