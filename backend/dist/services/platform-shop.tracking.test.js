"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Platform shop tracking URL sanitizer — run:
 * npx tsx src/services/platform-shop.tracking.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const platform_shop_service_1 = require("./platform-shop.service");
strict_1.default.equal((0, platform_shop_service_1.sanitizeTrackingUrl)(null), null);
strict_1.default.equal((0, platform_shop_service_1.sanitizeTrackingUrl)(""), null);
strict_1.default.equal((0, platform_shop_service_1.sanitizeTrackingUrl)("not-a-url"), null);
strict_1.default.equal((0, platform_shop_service_1.sanitizeTrackingUrl)("javascript:alert(1)"), null);
strict_1.default.equal((0, platform_shop_service_1.sanitizeTrackingUrl)("ftp://example.com/x"), null);
const https = (0, platform_shop_service_1.sanitizeTrackingUrl)("https://www.post.ch/track/ABC123");
strict_1.default.ok(https?.startsWith("https://www.post.ch/track/ABC123"));
const http = (0, platform_shop_service_1.sanitizeTrackingUrl)("http://example.com/t");
strict_1.default.ok(http?.startsWith("http://example.com/t"));
const schemeLess = (0, platform_shop_service_1.sanitizeTrackingUrl)("www.post.ch/track/ABC123");
strict_1.default.ok(schemeLess?.startsWith("https://www.post.ch/track/ABC123"));
console.log("platform-shop tracking tests passed");
//# sourceMappingURL=platform-shop.tracking.test.js.map