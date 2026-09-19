import { describe, expect, it } from "vitest";
import {
  incomingTaxRateOrPreserve,
  shouldWriteCredential,
} from "./merchant-settings-preserve";

describe("shouldWriteCredential", () => {
  it("rejects empty, undefined, and masked placeholders", () => {
    expect(shouldWriteCredential(undefined)).toBe(false);
    expect(shouldWriteCredential(null)).toBe(false);
    expect(shouldWriteCredential("")).toBe(false);
    expect(shouldWriteCredential("   ")).toBe(false);
    expect(shouldWriteCredential("AQE••••xxxx")).toBe(false);
  });

  it("accepts a real API key or client key", () => {
    expect(shouldWriteCredential("AQE1hmfx...real")).toBe(true);
    expect(shouldWriteCredential("live_abc123")).toBe(true);
  });
});

describe("incomingTaxRateOrPreserve", () => {
  it("preserves when the field was not edited", () => {
    expect(incomingTaxRateOrPreserve(undefined, "taxTakeawayRate")).toBeUndefined();
    expect(incomingTaxRateOrPreserve(null, "taxTakeawayRate")).toBeUndefined();
    expect(incomingTaxRateOrPreserve("", "vatRate")).toBeUndefined();
  });

  it("writes an explicit rate including 0%", () => {
    expect(incomingTaxRateOrPreserve(2.6, "taxTakeawayRate")).toBe("2.60");
    expect(incomingTaxRateOrPreserve(0, "taxTakeawayRate")).toBe("0.00");
    expect(incomingTaxRateOrPreserve("8.1", "vatRate")).toBe("8.10");
  });

  it("rejects out of range", () => {
    expect(() => incomingTaxRateOrPreserve(101, "vatRate")).toThrow(/between 0 and 100/);
  });
});
