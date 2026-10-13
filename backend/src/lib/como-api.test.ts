/**
 * Como API helpers — run: npx tsx backend/src/lib/como-api.test.ts
 */
import assert from "node:assert/strict";
import {
  buildComoPurchase,
  classifyComoIdentifier,
  fromComoMinorUnits,
  hasComoIdentifier,
  isComoCustomerNotFound,
  parseComoBenefits,
  parseComoConfirmation,
  parseComoMember,
  sanitizeComoError,
  toComoMinorUnits,
} from "./como-api.ts";

assert.deepEqual(classifyComoIdentifier("pos@como.com"), { email: "pos@como.com" });
assert.deepEqual(classifyComoIdentifier("+41 79 123 45 67").phoneNumber, "+41791234567");
assert.deepEqual(classifyComoIdentifier("0501234567").phoneNumber, "0501234567");
assert.equal(classifyComoIdentifier("MEMBER-QR-ABC").membershipKey, "MEMBER-QR-ABC");
assert.equal(hasComoIdentifier({}), false);
assert.equal(hasComoIdentifier({ phoneNumber: "1" }), true);

assert.equal(toComoMinorUnits(10.5), 1050);
assert.equal(fromComoMinorUnits(7060), 70.6);
assert.equal(fromComoMinorUnits("-500"), -5);

const purchase = buildComoPurchase({
  transactionId: "reborn-1",
  posId: "2",
  orderType: "dine_in",
  items: [{ sku: "COFFEE", quantity: 2, unitPrice: 3.5 }],
  totalMajor: 7,
});
assert.equal(purchase.items[0]?.lineId, "1");
assert.equal(purchase.items[0]?.itemCode, "COFFEE");
assert.equal(purchase.items[0]?.price, 350);
assert.equal(purchase.totalAmount, 700);

assert.equal(isComoCustomerNotFound("Customer Not Found"), true);
assert.equal(isComoCustomerNotFound("ok"), false);

const member = parseComoMember({
  membership: {
    MembershipKey: "abc",
    FirstName: "Como",
    LastName: "Test",
    PhoneNumber: "0501234567",
    Points: "312800",
  },
  assets: [{ key: "gift-1", name: "Free coffee", redeemable: true, type: "gift" }],
});
assert.equal(member.membershipKey, "abc");
assert.equal(member.firstName, "Como");
assert.equal(member.pointsBalance, 312800);
assert.equal(member.assets[0]?.redeemable, true);

const benefits = parseComoBenefits({
  ExternalBenefits: [{ AppliedAmount: "500", AssetName: "5 off", ItemCode: "DISC" }],
});
assert.equal(benefits.totalDiscountMinor, 500);
assert.equal(benefits.discounts[0]?.name, "5 off");

const conf = parseComoConfirmation({
  Confirmation: "LS09Ab",
  PurchaseKey: "LS09Ab",
  TransactionID: "66417",
});
assert.equal(conf.confirmation, "LS09Ab");
assert.equal(conf.transactionId, "66417");

const sanitized = sanitizeComoError('boom X-Api-Key: supersecret and apiKey="abc123"');
assert.equal(sanitized.includes("supersecret"), false);
assert.equal(sanitized.includes("abc123"), false);

console.log("como-api.test.ts: ok");
