import assert from "node:assert/strict";
import {
  healLegacyMashedReceiptHeader,
  normalizePosPrintSettings,
  parseReceiptHeaderLines,
} from "./pos-print-settings";

assert.deepEqual(
  healLegacyMashedReceiptHeader(
    "",
    "POLACAFE Bahnhofstrasse 1, Zürich Tel: +41 79 000 00 00 VAT: CHE-123.321.432"
  ),
  { receiptHeaderTitle: "", receiptHeader: "" }
);

assert.deepEqual(
  healLegacyMashedReceiptHeader("pola pola", "rue des saars 1152000 Neuchâtel"),
  { receiptHeaderTitle: "", receiptHeader: "" }
);

const kept = healLegacyMashedReceiptHeader("KABUL", "rue des saars 115\n2000 Neuchâtel");
assert.equal(kept.receiptHeaderTitle, "KABUL");
assert.ok(kept.receiptHeader.includes("Neuchâtel"));

const norm = normalizePosPrintSettings({
  receiptHeader:
    "POLACAFE Bahnhofstrasse 1ZürichTel: +41 79 000 00 00VAT: CHE-123.321.432 MWST",
});
assert.equal(norm.receiptHeader, "");
assert.equal(norm.receiptHeaderTitle, "");

assert.deepEqual(
  parseReceiptHeaderLines(
    ["pola pola", "rue des saars 115", "2000 Neuchâtel"],
    ""
  ),
  ["pola pola", "rue des saars 115", "2000 Neuchâtel"]
);

const normLines = normalizePosPrintSettings({
  receiptHeader: "pola pola\nrue des saars 115\n2000 Neuchâtel",
});
assert.deepEqual(normLines.receiptHeaderLines, [
  "pola pola",
  "rue des saars 115",
  "2000 Neuchâtel",
]);

console.log("pos-print-settings.receipt-header-heal.test.ts ok");
