"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const barcode_service_1 = require("./barcode.service");
strict_1.default.equal(barcode_service_1.INTERNAL_BARCODE_PREFIX, "20");
strict_1.default.equal(barcode_service_1.INTERNAL_BARCODE_LENGTH, 12);
strict_1.default.equal((0, barcode_service_1.formatInternalBarcode)(1), "200000000001");
strict_1.default.equal((0, barcode_service_1.isNumericSkuAsBarcode)("590123412345"), true);
strict_1.default.equal((0, barcode_service_1.isNumericSkuAsBarcode)("BKR CGF"), false);
strict_1.default.equal((0, barcode_service_1.isNumericSkuAsBarcode)("C12345678901"), false);
const taken = new Set();
const first = (0, barcode_service_1.allocateInternalBarcode)(taken);
strict_1.default.equal(first, "200000000001");
strict_1.default.match(first, /^\d{12}$/);
strict_1.default.equal(barcode_service_1.BarcodeService.normalizeForSave("  7612345678901 "), "7612345678901");
strict_1.default.equal(barcode_service_1.BarcodeService.normalizeForSave(""), null);
strict_1.default.equal(barcode_service_1.BarcodeService.normalizeForSave("   "), null);
strict_1.default.equal(barcode_service_1.BarcodeService.normalizeForSave(null), null);
strict_1.default.equal(barcode_service_1.BarcodeService.normalizeForSave(undefined), null);
strict_1.default.ok((0, barcode_service_1.barcodeMatchVariants)("612345678901").includes("612345678901"));
strict_1.default.ok((0, barcode_service_1.barcodeMatchVariants)("0612345678901").includes("612345678901"));
strict_1.default.ok((0, barcode_service_1.barcodeMatchVariants)("612345678901").includes("0612345678901"));
console.log("barcode.service.test.ts ok");
//# sourceMappingURL=barcode.service.test.js.map