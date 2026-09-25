"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Merchant email addressing — run: npx tsx backend/src/lib/merchant-email-address.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const merchant_email_address_1 = require("./merchant-email-address");
strict_1.default.equal((0, merchant_email_address_1.merchantSenderDisplayName)("Pola Cafe"), "Pola Cafe");
strict_1.default.equal((0, merchant_email_address_1.merchantSenderDisplayName)("  "), "Shop");
strict_1.default.equal((0, merchant_email_address_1.merchantSenderDisplayName)(null), "Shop");
strict_1.default.equal((0, merchant_email_address_1.resolveMerchantContactEmail)({
    email: "owner@shop.example",
    smtpSettings: { fromEmail: "smtp@shop.example" },
}), "owner@shop.example");
strict_1.default.equal((0, merchant_email_address_1.resolveMerchantContactEmail)({
    email: "",
    smtpSettings: { fromEmail: "smtp@shop.example" },
}), "smtp@shop.example");
strict_1.default.equal((0, merchant_email_address_1.resolveMerchantContactEmail)({
    email: null,
    brevoSettings: { fromEmail: "brevo@shop.example" },
}), "brevo@shop.example");
strict_1.default.equal((0, merchant_email_address_1.resolveMerchantContactEmail)({ email: null }), null);
strict_1.default.equal((0, merchant_email_address_1.formatMailAddress)("shop@example.com", "Pola Cafe"), '"Pola Cafe" <shop@example.com>');
strict_1.default.equal((0, merchant_email_address_1.formatMailAddress)("shop@example.com", ""), "shop@example.com");
strict_1.default.equal((0, merchant_email_address_1.formatMailAddress)("shop@example.com"), "shop@example.com");
console.log("merchant-email-address.test.ts: ok");
//# sourceMappingURL=merchant-email-address.test.js.map