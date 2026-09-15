"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop URL filtering + delivery mode helpers — run: cd backend && npx tsx src/lib/shop-delivery-mode.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const shop_public_urls_1 = require("./shop-public-urls");
const delivery_match_1 = require("./delivery-match");
strict_1.default.equal((0, shop_public_urls_1.isHiddenMerchantShopUrl)("https://demo.chaslay.com"), true);
strict_1.default.equal((0, shop_public_urls_1.isHiddenMerchantShopUrl)("https://demo.chaslay.com/menu"), true);
strict_1.default.equal((0, shop_public_urls_1.isHiddenMerchantShopUrl)("https://shop.app.chaslay.com/demo/menu"), true);
strict_1.default.equal((0, shop_public_urls_1.filterMerchantShopUrl)("https://shop.chaslay.com/my-cafe"), "https://shop.chaslay.com/my-cafe");
strict_1.default.equal((0, shop_public_urls_1.filterMerchantShopUrl)("https://demo.chaslay.com"), null);
strict_1.default.deepEqual((0, shop_public_urls_1.listMerchantShopPublicLinks)({
    shopPathUrl: "https://order.rebornsense.com/my-cafe",
    shopMenuUrl: "https://order.rebornsense.com/my-cafe/menu",
    shopPanelPathUrl: "https://app.rebornsense.com/shop/my-cafe",
    shopSubdomainUrl: "https://my-cafe.rebornsense.com",
}), [{ key: "shopWebsiteLink", url: "https://order.rebornsense.com/my-cafe" }]);
strict_1.default.deepEqual((0, shop_public_urls_1.listMerchantShopPublicLinks)({
    shopPathUrl: "https://order.rebornsense.com/my-cafe",
    shopCustomDomainUrl: "https://www.mycafe.ch",
}), [{ key: "shopCustomDomainLink", url: "https://www.mycafe.ch" }]);
strict_1.default.deepEqual((0, shop_public_urls_1.listMerchantShopPublicLinks)({
    shopPathUrl: "https://shop.chaslay.com/demo",
}), [{ key: "shopWebsiteLink", url: "https://shop.chaslay.com/demo" }]);
strict_1.default.equal((0, delivery_match_1.normalizeDeliveryMode)("zipcode"), "zipcode");
strict_1.default.equal((0, delivery_match_1.normalizeDeliveryMode)("zones"), "zones");
strict_1.default.equal((0, delivery_match_1.normalizeDeliveryMode)("invalid"), "zones");
strict_1.default.equal((0, delivery_match_1.normalizeZipCode)(" 8001 "), "8001");
console.log("shop-delivery-mode.test.ts: ok");
//# sourceMappingURL=shop-delivery-mode.test.js.map