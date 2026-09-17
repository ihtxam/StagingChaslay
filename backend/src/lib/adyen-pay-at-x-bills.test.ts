import assert from "node:assert/strict";
import test from "node:test";
import {
  calcSplitPaymentAmounts,
  filterOpenBillsForStaff,
  matchBillByTableInput,
  parseReferenceFromEventDetails,
} from "./adyen-pay-at-x-bills.ts";

test("parseReferenceFromEventDetails extracts reference_id", () => {
  assert.equal(parseReferenceFromEventDetails("reference_id=0123456789"), "0123456789");
  assert.equal(parseReferenceFromEventDetails("foo=1,reference_id=4242,bar=2"), "4242");
  assert.equal(parseReferenceFromEventDetails(""), null);
});

test("filterOpenBillsForStaff prefers staff bills when present", () => {
  const bills = [
    { id: "a", cartJson: {}, staffId: "s1" },
    { id: "b", cartJson: {}, staffId: "s2" },
    { id: "c", cartJson: {}, staffId: null },
  ];
  const filtered = filterOpenBillsForStaff(bills, "s2");
  assert.deepEqual(filtered.map((b) => b.id), ["b"]);
});

test("filterOpenBillsForStaff falls back to all bills when staff has none", () => {
  const bills = [
    { id: "a", cartJson: {}, staffId: "s1" },
    { id: "b", cartJson: {}, staffId: null },
  ];
  const filtered = filterOpenBillsForStaff(bills, "missing");
  assert.equal(filtered.length, 2);
});

test("matchBillByTableInput matches ticket, table, and label", () => {
  const bills = [
    {
      id: "1",
      label: "Patio 3",
      cartJson: { ticketDisplay: "#42", tableId: "t-3", tableLabel: "Table 3" },
    },
    {
      id: "2",
      label: "Bar",
      cartJson: { ticketDisplay: "#99", tableId: "bar-1", tableLabel: "Bar 1" },
    },
  ];
  assert.deepEqual(matchBillByTableInput(bills, "42").map((b) => b.id), ["1"]);
  assert.deepEqual(matchBillByTableInput(bills, "t-3").map((b) => b.id), ["1"]);
  assert.deepEqual(matchBillByTableInput(bills, "patio").map((b) => b.id), ["1"]);
});

test("calcSplitPaymentAmounts computes requested and paid amounts", () => {
  const first = calcSplitPaymentAmounts(44, 0);
  assert.equal(first.requestedAmount, 44);
  assert.equal(first.paidAmount, 0);
  assert.equal(first.fullyPaid, false);

  const partial = calcSplitPaymentAmounts(44, 20);
  assert.equal(partial.requestedAmount, 24);
  assert.equal(partial.paidAmount, 20);
  assert.equal(partial.fullyPaid, false);

  const done = calcSplitPaymentAmounts(44, 44);
  assert.equal(done.requestedAmount, 0);
  assert.equal(done.paidAmount, 44);
  assert.equal(done.fullyPaid, true);
});
