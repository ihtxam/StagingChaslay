/**
 * Merchant email addressing — run: npx tsx backend/src/lib/merchant-email-address.test.ts
 */
import assert from "node:assert/strict";
import {
  formatMailAddress,
  merchantSenderDisplayName,
  resolveMerchantContactEmail,
} from "./merchant-email-address";

assert.equal(merchantSenderDisplayName("Pola Cafe"), "Pola Cafe");
assert.equal(merchantSenderDisplayName("  "), "Shop");
assert.equal(merchantSenderDisplayName(null), "Shop");

assert.equal(
  resolveMerchantContactEmail({
    email: "owner@shop.example",
    smtpSettings: { fromEmail: "smtp@shop.example" },
  }),
  "owner@shop.example"
);
assert.equal(
  resolveMerchantContactEmail({
    email: "",
    smtpSettings: { fromEmail: "smtp@shop.example" },
  }),
  "smtp@shop.example"
);
assert.equal(
  resolveMerchantContactEmail({
    email: null,
    brevoSettings: { fromEmail: "brevo@shop.example" },
  }),
  "brevo@shop.example"
);
assert.equal(resolveMerchantContactEmail({ email: null }), null);

assert.equal(
  formatMailAddress("shop@example.com", "Pola Cafe"),
  '"Pola Cafe" <shop@example.com>'
);
assert.equal(formatMailAddress("shop@example.com", ""), "shop@example.com");
assert.equal(formatMailAddress("shop@example.com"), "shop@example.com");

console.log("merchant-email-address.test.ts: ok");
