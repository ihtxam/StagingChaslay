/**
 * Mailco routing helpers — run: npx tsx backend/src/lib/mailco-routing.test.ts
 */
import assert from "node:assert/strict";
import { isTransientMailcoError } from "./mailco-routing";

assert.equal(isTransientMailcoError({ response: { status: 422 } }), false);
assert.equal(isTransientMailcoError({ response: { status: 401 } }), false);
assert.equal(isTransientMailcoError({ response: { status: 503 } }), true);
assert.equal(isTransientMailcoError({ response: { status: 429 } }), true);
assert.equal(isTransientMailcoError({ code: "ETIMEDOUT" }), true);
assert.equal(
  isTransientMailcoError({ message: "template_invalid: slug not found" }),
  false
);

console.log("mailco-routing.test.ts: ok");
