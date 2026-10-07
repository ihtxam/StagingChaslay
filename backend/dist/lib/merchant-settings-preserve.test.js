"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const merchant_settings_preserve_1 = require("./merchant-settings-preserve");
(0, vitest_1.describe)("shouldWriteCredential", () => {
    (0, vitest_1.it)("rejects empty, undefined, and masked placeholders", () => {
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)(undefined)).toBe(false);
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)(null)).toBe(false);
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)("")).toBe(false);
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)("   ")).toBe(false);
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)("AQE••••xxxx")).toBe(false);
    });
    (0, vitest_1.it)("accepts a real API key or client key", () => {
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)("AQE1hmfx...real")).toBe(true);
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.shouldWriteCredential)("live_abc123")).toBe(true);
    });
});
(0, vitest_1.describe)("incomingTaxRateOrPreserve", () => {
    (0, vitest_1.it)("preserves when the field was not edited", () => {
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)(undefined, "taxTakeawayRate")).toBeUndefined();
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)(null, "taxTakeawayRate")).toBeUndefined();
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)("", "vatRate")).toBeUndefined();
    });
    (0, vitest_1.it)("writes an explicit rate including 0%", () => {
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)(2.6, "taxTakeawayRate")).toBe("2.60");
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)(0, "taxTakeawayRate")).toBe("0.00");
        (0, vitest_1.expect)((0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)("8.1", "vatRate")).toBe("8.10");
    });
    (0, vitest_1.it)("rejects out of range", () => {
        (0, vitest_1.expect)(() => (0, merchant_settings_preserve_1.incomingTaxRateOrPreserve)(101, "vatRate")).toThrow(/between 0 and 100/);
    });
});
//# sourceMappingURL=merchant-settings-preserve.test.js.map