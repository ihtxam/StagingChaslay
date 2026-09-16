import assert from "node:assert/strict";
import { normalizePosPrintSettings } from "./pos-print-settings";

const defaults = normalizePosPrintSettings({});
assert.equal(defaults.orderLabelEnabled, false);
assert.equal(defaults.autoPrintOrderLabelOnHold, true);
assert.equal(defaults.autoPrintOrderLabelOnSend, false);

const enabled = normalizePosPrintSettings({
  orderLabelEnabled: true,
  autoPrintOrderLabelOnHold: false,
  autoPrintOrderLabelOnSend: true,
});
assert.equal(enabled.orderLabelEnabled, true);
assert.equal(enabled.autoPrintOrderLabelOnHold, false);
assert.equal(enabled.autoPrintOrderLabelOnSend, true);

console.log("pos-print-settings order labels: ok");
