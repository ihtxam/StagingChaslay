import { describe, expect, it } from "vitest";
import {
  isPaidOnlineEcommerce,
  isUsableAdyenPspReference,
  remainingRefundableAmount,
} from "./online-payment-refund";

describe("isPaidOnlineEcommerce", () => {
  it("refunds paid-online shop card orders", () => {
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "card",
        paymentStatus: "completed",
        orderType: "web_shop",
        orderSource: "online_shop",
        adyenReference: "K8Q2XXXX",
      })
    ).toBe(true);
  });

  it("refunds TWINT ecommerce (still Adyen Checkout, just not tokenizable)", () => {
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "twint",
        paymentStatus: "paid",
        orderType: "web_shop",
      })
    ).toBe(true);
  });

  it("does not refund cash or unpaid", () => {
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "cash",
        paymentStatus: "completed",
        orderType: "web_shop",
      })
    ).toBe(false);
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "card",
        paymentStatus: "awaiting_payment",
        orderType: "web_shop",
      })
    ).toBe(false);
  });

  it("does not treat POS terminal card as ecommerce", () => {
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "card",
        paymentStatus: "completed",
        adyenPoiTransactionTs: new Date(),
      })
    ).toBe(false);
    expect(
      isPaidOnlineEcommerce({
        paymentMethod: "terminal",
        paymentStatus: "completed",
      })
    ).toBe(false);
  });
});

describe("psp + remaining", () => {
  it("rejects demo/placeholder Adyen references", () => {
    expect(isUsableAdyenPspReference("DEMO-WEB-B335-11")).toBe(false);
    expect(isUsableAdyenPspReference("K8Q2ABCD1234")).toBe(true);
  });

  it("computes remaining refund", () => {
    expect(remainingRefundableAmount({ total: "20.00", refundAmount: "5" })).toBe(15);
  });
});
