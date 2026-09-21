import assert from "node:assert/strict";
import { buildCdsPublicUrl } from "./customer-display-settings";

const origin = "https://app.rebornsense.com";
assert.equal(
  buildCdsPublicUrl("exotic-market", "48291", origin),
  "https://app.rebornsense.com/cds/m/exotic-market"
);
assert.equal(
  buildCdsPublicUrl(null, "48291", origin),
  "https://app.rebornsense.com/cds/48291"
);

console.log("customer-display-settings.test.ts ok");
