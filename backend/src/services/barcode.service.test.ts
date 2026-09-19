import assert from "node:assert/strict";
import {
  allocateInternalBarcode,
  BarcodeService,
  formatInternalBarcode,
  INTERNAL_BARCODE_LENGTH,
  INTERNAL_BARCODE_PREFIX,
  isNumericSkuAsBarcode,
} from "./barcode.service";

assert.equal(INTERNAL_BARCODE_PREFIX, "20");
assert.equal(INTERNAL_BARCODE_LENGTH, 12);
assert.equal(formatInternalBarcode(1), "200000000001");
assert.equal(isNumericSkuAsBarcode("590123412345"), true);
assert.equal(isNumericSkuAsBarcode("BKR CGF"), false);
assert.equal(isNumericSkuAsBarcode("C12345678901"), false);

const taken = new Set<string>();
const first = allocateInternalBarcode(taken);
assert.equal(first, "200000000001");
assert.match(first!, /^\d{12}$/);

assert.equal(BarcodeService.normalizeForSave("  7612345678901 "), "7612345678901");
assert.equal(BarcodeService.normalizeForSave(""), null);
assert.equal(BarcodeService.normalizeForSave("   "), null);
assert.equal(BarcodeService.normalizeForSave(null), null);
assert.equal(BarcodeService.normalizeForSave(undefined), null);

console.log("barcode.service.test.ts ok");
