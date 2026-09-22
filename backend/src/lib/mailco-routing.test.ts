/**
 * Mailco routing helpers — run: npx tsx backend/src/lib/mailco-routing.test.ts
 */
import assert from "node:assert/strict";
import {
  isMailcoBrevoFallbackEnabled,
  isTransientMailcoError,
  MailcoSendError,
} from "./mailco-routing";

const prevFallback = process.env.MAILCO_BREVO_FALLBACK;
delete process.env.MAILCO_BREVO_FALLBACK;
assert.equal(isMailcoBrevoFallbackEnabled(), false);
process.env.MAILCO_BREVO_FALLBACK = "1";
assert.equal(isMailcoBrevoFallbackEnabled(), true);
process.env.MAILCO_BREVO_FALLBACK = "yes";
assert.equal(isMailcoBrevoFallbackEnabled(), true);
if (prevFallback === undefined) delete process.env.MAILCO_BREVO_FALLBACK;
else process.env.MAILCO_BREVO_FALLBACK = prevFallback;

assert.equal(isTransientMailcoError({ response: { status: 422 } }), false);
assert.equal(isTransientMailcoError({ response: { status: 401 } }), false);
assert.equal(isTransientMailcoError({ response: { status: 503 } }), true);
assert.equal(isTransientMailcoError({ response: { status: 429 } }), true);
assert.equal(isTransientMailcoError({ code: "ETIMEDOUT" }), true);
assert.equal(
  isTransientMailcoError({ message: "template_invalid: slug not found" }),
  false
);

// Wrapped mailco errors (production path) must preserve status for routing.
assert.equal(
  isTransientMailcoError(new MailcoSendError("domain not verified", { status: 422 })),
  false
);
assert.equal(
  isTransientMailcoError(new MailcoSendError("service unavailable", { status: 503 })),
  true
);
// Plain Error without status must NOT trigger Brevo fallback.
assert.equal(isTransientMailcoError(new Error("mailco send failed")), false);

console.log("mailco-routing.test.ts: ok");
