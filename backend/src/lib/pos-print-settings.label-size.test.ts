import assert from "node:assert/strict";
import { normalizePosPrintSettings, parseLabelHeightMm, parseLabelWidthMm } from "./pos-print-settings";

assert.equal(parseLabelWidthMm(100), 100);
assert.equal(parseLabelWidthMm(80), 80);
assert.equal(parseLabelWidthMm(12), 40);
assert.equal(parseLabelHeightMm(150), 150);
assert.equal(parseLabelHeightMm(50), 50);
assert.equal(parseLabelHeightMm(99), 20);

const settings = normalizePosPrintSettings({
  labelWidthMm: 100,
  labelHeightMm: 50,
  printers: [{ id: "p1", name: "EML-400L (4inch)", printLabels: true }],
});
assert.equal(settings.labelWidthMm, 100);
assert.equal(settings.labelHeightMm, 50);
assert.equal(settings.printers?.[0]?.printLabels, true);

console.log("pos-print-settings label sizes: ok");
