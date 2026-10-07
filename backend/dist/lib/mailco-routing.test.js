"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Mailco routing helpers — run: npx tsx backend/src/lib/mailco-routing.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const mailco_routing_1 = require("./mailco-routing");
const prevFallback = process.env.MAILCO_BREVO_FALLBACK;
delete process.env.MAILCO_BREVO_FALLBACK;
strict_1.default.equal((0, mailco_routing_1.isMailcoBrevoFallbackEnabled)(), false);
process.env.MAILCO_BREVO_FALLBACK = "1";
strict_1.default.equal((0, mailco_routing_1.isMailcoBrevoFallbackEnabled)(), true);
process.env.MAILCO_BREVO_FALLBACK = "yes";
strict_1.default.equal((0, mailco_routing_1.isMailcoBrevoFallbackEnabled)(), true);
if (prevFallback === undefined)
    delete process.env.MAILCO_BREVO_FALLBACK;
else
    process.env.MAILCO_BREVO_FALLBACK = prevFallback;
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ response: { status: 422 } }), false);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ response: { status: 401 } }), false);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ response: { status: 503 } }), true);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ response: { status: 429 } }), true);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ code: "ETIMEDOUT" }), true);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)({ message: "template_invalid: slug not found" }), false);
// Wrapped mailco errors (production path) must preserve status for routing.
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)(new mailco_routing_1.MailcoSendError("domain not verified", { status: 422 })), false);
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)(new mailco_routing_1.MailcoSendError("service unavailable", { status: 503 })), true);
// Plain Error without status must NOT trigger Brevo fallback.
strict_1.default.equal((0, mailco_routing_1.isTransientMailcoError)(new Error("mailco send failed")), false);
strict_1.default.equal((0, mailco_routing_1.isPlatformMailcoEmailType)("shop_order"), true);
strict_1.default.equal((0, mailco_routing_1.isPlatformMailcoEmailType)("platform_shop_order"), true);
strict_1.default.equal((0, mailco_routing_1.isPlatformMailcoEmailType)("newsletter"), false);
strict_1.default.equal((0, mailco_routing_1.isPlatformMailcoEmailType)(undefined), false);
console.log("mailco-routing.test.ts: ok");
//# sourceMappingURL=mailco-routing.test.js.map