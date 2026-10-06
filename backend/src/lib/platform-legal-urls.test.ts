/**
 * Platform legal URLs — run: cd backend && npx tsx src/lib/platform-legal-urls.test.ts
 */
import assert from "node:assert/strict";
import { defaultPlatformLegalUrls, resolvePlatformLegalUrls } from "./platform-legal-urls.ts";

const defaults = defaultPlatformLegalUrls();
assert.equal(defaults.privacy, "https://rebornsense.com/privacy-policy");
assert.equal(defaults.terms, "https://rebornsense.com/terms-of-use");
assert.equal(defaults.cookies, "https://rebornsense.com/cookie-policy");

const custom = resolvePlatformLegalUrls({
  privacyUrl: "https://rebornsense.com/custom-privacy",
  termsUrl: "",
  cookiesUrl: null,
});
assert.equal(custom.privacy, "https://rebornsense.com/custom-privacy");
assert.equal(custom.terms, defaults.terms);

console.log("platform-legal-urls tests passed");
