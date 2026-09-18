"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const shop_site_settings_1 = require("./shop-site-settings");
strict_1.default.equal((0, shop_site_settings_1.normalizeGaMeasurementId)("g-abc123xyz"), "G-ABC123XYZ");
strict_1.default.equal((0, shop_site_settings_1.normalizeGaMeasurementId)("UA-123"), null);
strict_1.default.equal((0, shop_site_settings_1.normalizeGaMeasurementId)(""), null);
const parsed = (0, shop_site_settings_1.normalizeShopSiteSettings)({
    brandColor: "#e11",
    metaTitle: { en: "  Bravo Pizza  ", fr: "x".repeat(80) },
    metaDescription: { de: "Hallo" },
    gaMeasurementId: "G-TESTID01",
    faviconUrl: "/api/uploads/m/icon.png",
});
strict_1.default.equal(parsed.brandColor, "#ee1111");
strict_1.default.equal(parsed.metaTitle.en, "Bravo Pizza");
strict_1.default.equal(parsed.metaTitle.fr?.length, 60);
strict_1.default.equal(parsed.metaDescription.de, "Hallo");
strict_1.default.equal(parsed.gaMeasurementId, "G-TESTID01");
strict_1.default.equal((0, shop_site_settings_1.localizedShopCopy)(parsed.metaTitle, "fr").length, 60);
strict_1.default.equal((0, shop_site_settings_1.localizedShopCopy)({ en: "Shop", fr: "Boutique" }, "fr"), "Boutique");
strict_1.default.equal((0, shop_site_settings_1.localizedShopCopy)({ en: "Shop" }, "it"), "Shop");
const homeSeo = (0, shop_site_settings_1.resolveShopDocumentSeo)(parsed, "de", {
    title: "Builder Home",
    description: "Page copy",
});
strict_1.default.equal(homeSeo.title, "Bravo Pizza");
strict_1.default.equal(homeSeo.description, "Hallo");
strict_1.default.equal(homeSeo.faviconUrl, "/api/uploads/m/icon.png");
const fallbackSeo = (0, shop_site_settings_1.resolveShopDocumentSeo)(null, "en", {
    title: "Builder Home",
    description: "Page copy",
});
strict_1.default.equal(fallbackSeo.title, "Builder Home");
strict_1.default.equal(fallbackSeo.description, "Page copy");
strict_1.default.equal(fallbackSeo.faviconUrl, null);
console.log("shop-site-settings tests passed");
//# sourceMappingURL=shop-site-settings.test.js.map