"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Default shop privacy policy — run: cd backend && npx tsx src/lib/shop-privacy-policy.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const shop_privacy_policy_ts_1 = require("./shop-privacy-policy.ts");
strict_1.default.equal(shop_privacy_policy_ts_1.SHOP_PRIVACY_POLICY_SLUG, "privacy-policy");
const merchant = {
    name: "Brazza Pizza",
    email: "info@brazzapizza.ch",
    phone: "+41 44 123 45 67",
    address: "Bahnhofstrasse 1",
    city: "Zürich",
    country: "Switzerland",
    shopLanguage: "de",
};
strict_1.default.equal((0, shop_privacy_policy_ts_1.resolvePrivacyContactName)(merchant, "Manager"), "Brazza Pizza");
strict_1.default.equal((0, shop_privacy_policy_ts_1.resolvePrivacyContactName)(merchant, "Marco Rossi"), "Marco Rossi");
const de = (0, shop_privacy_policy_ts_1.buildDefaultPrivacyPolicyHtml)(merchant, "Marco Rossi");
strict_1.default.equal(de.title, "Datenschutzerklärung");
strict_1.default.match(de.htmlContent, /Brazza Pizza/);
strict_1.default.match(de.htmlContent, /Marco Rossi/);
strict_1.default.match(de.htmlContent, /info@brazzapizza\.ch/);
strict_1.default.match(de.htmlContent, /webprintmedia\.swiss/);
strict_1.default.match(de.htmlContent, /www\.rebornsense\.com/);
strict_1.default.match(de.htmlContent, /Adyen/);
const en = (0, shop_privacy_policy_ts_1.buildDefaultPrivacyPolicyHtml)({ ...merchant, shopLanguage: "en" }, "Jane Doe");
strict_1.default.equal(en.title, "Privacy Policy");
strict_1.default.match(en.htmlContent, /Jane Doe/);
console.log("shop-privacy-policy tests passed");
//# sourceMappingURL=shop-privacy-policy.test.js.map