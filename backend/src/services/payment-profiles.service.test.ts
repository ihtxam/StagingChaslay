/**
 * Run: cd backend && npx tsx src/services/payment-profiles.service.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allowManualPaymentProfileCreate } from "./payment-profiles.service.ts";

const root = dirname(fileURLToPath(import.meta.url));

assert.equal(allowManualPaymentProfileCreate(), false, "manual profile create gated by default");

const serviceSrc = readFileSync(join(root, "payment-profiles.service.ts"), "utf8");
const locationsSrc = readFileSync(join(root, "locations.service.ts"), "utf8");
const schemaSrc = readFileSync(join(root, "../lib/ensure-merchant-schema.ts"), "utf8");

assert.match(serviceSrc, /ensureProfileForLocation/, "branch auto-profile helper");
assert.match(locationsSrc, /ensureProfileForLocation/, "location create wires profile");
assert.match(schemaSrc, /pp\.location_id = l\.id/, "schema heal backfills per location");

console.log("payment-profiles.service.test.ts: ok");
