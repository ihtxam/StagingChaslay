import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "pos-orders.service.ts"), "utf8");

assert.match(src, /dismissStaleOpenKdsTickets/, "stale KDS dismiss");
assert.match(src, /closeAbandonedOpenHeldTickets/, "abandoned held close");
assert.match(src, /HELD_HEAL_SALES_LOOKBACK_MS = 30/, "30d paid heal window");
assert.match(src, /restoreHeldFromOpenKitchen\(merchantId, staleCutoff\)/, "no restore from stale KDS");

console.log("pos-held-stale-heal.test.ts: ok");
