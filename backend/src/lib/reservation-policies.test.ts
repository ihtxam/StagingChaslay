import assert from "node:assert/strict";
import {
  canCancelWithoutForfeit,
  depositDueAmount,
  nextDepositStatusOnCancel,
  normalizeReservationPolicies,
  quoteWaitMinutes,
} from "./reservation-policies";

const policies = normalizeReservationPolicies({
  depositEnabled: true,
  depositAmount: 20,
  depositType: "fixed",
  cancelHoursBefore: 24,
  waitlistQuoteMinutes: 25,
});

assert.equal(policies.depositAmount, 20);
assert.equal(depositDueAmount(policies, 4), 20);
assert.equal(
  depositDueAmount(normalizeReservationPolicies({ depositEnabled: true, depositAmount: 10, depositType: "percent" }), 3),
  30
);

assert.equal(quoteWaitMinutes({ position: 0, quoteMinutes: 25 }), 25);
assert.equal(quoteWaitMinutes({ position: 1, seatingDurationMinutes: 90, openTables: 3 }), 60);

const soon = new Date(Date.now() + 2 * 3600_000);
const later = new Date(Date.now() + 48 * 3600_000);
assert.equal(canCancelWithoutForfeit(later, 24), true);
assert.equal(canCancelWithoutForfeit(soon, 24), false);
assert.equal(nextDepositStatusOnCancel("collected", later, 24), "refunded");
assert.equal(nextDepositStatusOnCancel("collected", soon, 24), "forfeited");
assert.equal(nextDepositStatusOnCancel("due", soon, 24), "none");

console.log("reservation-policies.test.ts ok");
