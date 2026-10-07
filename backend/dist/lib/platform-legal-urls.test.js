"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Platform legal URLs — run: cd backend && npx tsx src/lib/platform-legal-urls.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const platform_legal_urls_ts_1 = require("./platform-legal-urls.ts");
const defaults = (0, platform_legal_urls_ts_1.defaultPlatformLegalUrls)();
strict_1.default.equal(defaults.privacy, "https://rebornsense.com/privacy-policy");
strict_1.default.equal(defaults.terms, "https://rebornsense.com/terms-of-use");
strict_1.default.equal(defaults.cookies, "https://rebornsense.com/cookie-policy");
const custom = (0, platform_legal_urls_ts_1.resolvePlatformLegalUrls)({
    privacyUrl: "https://rebornsense.com/custom-privacy",
    termsUrl: "",
    cookiesUrl: null,
});
strict_1.default.equal(custom.privacy, "https://rebornsense.com/custom-privacy");
strict_1.default.equal(custom.terms, defaults.terms);
console.log("platform-legal-urls tests passed");
//# sourceMappingURL=platform-legal-urls.test.js.map