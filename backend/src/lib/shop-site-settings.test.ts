import assert from "node:assert/strict";
import {
  localizedShopCopy,
  normalizeGaMeasurementId,
  normalizeShopSiteSettings,
} from "./shop-site-settings";

assert.equal(normalizeGaMeasurementId("g-abc123xyz"), "G-ABC123XYZ");
assert.equal(normalizeGaMeasurementId("UA-123"), null);
assert.equal(normalizeGaMeasurementId(""), null);

const parsed = normalizeShopSiteSettings({
  brandColor: "#e11",
  metaTitle: { en: "  Bravo Pizza  ", fr: "x".repeat(80) },
  metaDescription: { de: "Hallo" },
  gaMeasurementId: "G-TESTID01",
  faviconUrl: "/api/uploads/m/icon.png",
});
assert.equal(parsed.brandColor, "#ee1111");
assert.equal(parsed.metaTitle.en, "Bravo Pizza");
assert.equal(parsed.metaTitle.fr?.length, 60);
assert.equal(parsed.metaDescription.de, "Hallo");
assert.equal(parsed.gaMeasurementId, "G-TESTID01");
assert.equal(localizedShopCopy(parsed.metaTitle, "fr").length, 60);
assert.equal(localizedShopCopy({ en: "Shop", fr: "Boutique" }, "fr"), "Boutique");
assert.equal(localizedShopCopy({ en: "Shop" }, "it"), "Shop");

console.log("shop-site-settings tests passed");
