/**
 * Default shop privacy policy — run: cd backend && npx tsx src/lib/shop-privacy-policy.test.ts
 */
import assert from "node:assert/strict";
import {
  SHOP_PRIVACY_POLICY_SLUG,
  buildDefaultPrivacyPolicyHtml,
  resolvePrivacyContactName,
} from "./shop-privacy-policy.ts";

assert.equal(SHOP_PRIVACY_POLICY_SLUG, "privacy-policy");

const merchant = {
  name: "Brazza Pizza",
  email: "info@brazzapizza.ch",
  phone: "+41 44 123 45 67",
  address: "Bahnhofstrasse 1",
  city: "Zürich",
  country: "Switzerland",
  shopLanguage: "de",
};

assert.equal(resolvePrivacyContactName(merchant, "Manager"), "Brazza Pizza");
assert.equal(resolvePrivacyContactName(merchant, "Marco Rossi"), "Marco Rossi");

const de = buildDefaultPrivacyPolicyHtml(merchant, "Marco Rossi");
assert.equal(de.title, "Datenschutzerklärung");
assert.match(de.htmlContent, /Brazza Pizza/);
assert.match(de.htmlContent, /Marco Rossi/);
assert.match(de.htmlContent, /info@brazzapizza\.ch/);
assert.match(de.htmlContent, /webprintmedia\.swiss/);
assert.match(de.htmlContent, /www\.rebornsense\.com/);
assert.match(de.htmlContent, /Adyen/);

const en = buildDefaultPrivacyPolicyHtml({ ...merchant, shopLanguage: "en" }, "Jane Doe");
assert.equal(en.title, "Privacy Policy");
assert.match(en.htmlContent, /Jane Doe/);

console.log("shop-privacy-policy tests passed");
