/**
 * Platform shop tracking URL sanitizer — run:
 * npx tsx src/services/platform-shop.tracking.test.ts
 */
import assert from "node:assert/strict";
import { sanitizeTrackingUrl } from "./platform-shop.service";

assert.equal(sanitizeTrackingUrl(null), null);
assert.equal(sanitizeTrackingUrl(""), null);
assert.equal(sanitizeTrackingUrl("not-a-url"), null);
assert.equal(sanitizeTrackingUrl("javascript:alert(1)"), null);
assert.equal(sanitizeTrackingUrl("ftp://example.com/x"), null);

const https = sanitizeTrackingUrl("https://www.post.ch/track/ABC123");
assert.ok(https?.startsWith("https://www.post.ch/track/ABC123"));

const http = sanitizeTrackingUrl("http://example.com/t");
assert.ok(http?.startsWith("http://example.com/t"));

console.log("platform-shop tracking tests passed");
