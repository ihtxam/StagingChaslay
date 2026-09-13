/**
 * POS offer visibility — run: cd backend && npx tsx src/services/offers.pos.test.ts
 */
import assert from "node:assert/strict";
import {
  isOfferListedOnPos,
  offerMatchesPosStaff,
  offerStaffIds,
  posOfferStatus,
} from "../lib/pos-offer-visibility";

const waiter = "staff-waiter-1";
const driver = "staff-delivery-1";
const now = new Date("2026-09-13T12:00:00.000Z");

const base = {
  isActive: true,
  validFrom: null as Date | null,
  validTo: null as Date | null,
  staffIds: [] as string[],
};

assert.deepEqual(offerStaffIds({ staffIds: null }), []);
assert.ok(offerMatchesPosStaff(base, waiter));
assert.ok(offerMatchesPosStaff({ staffIds: [waiter] }, waiter));
assert.equal(offerMatchesPosStaff({ staffIds: [waiter] }, driver), false);
assert.equal(offerMatchesPosStaff({ staffIds: [waiter] }, null), false);
assert.ok(offerMatchesPosStaff({ staffIds: [waiter] }, null, true), "owner sees targeted offers");

assert.ok(isOfferListedOnPos(base, now, waiter), "all-user offer is visible");
assert.equal(
  isOfferListedOnPos({ ...base, staffIds: [driver] }, now, waiter),
  false,
  "other staff's offer is hidden"
);
assert.ok(
  isOfferListedOnPos({ ...base, staffIds: [waiter] }, now, waiter),
  "own targeted offer is visible"
);

const tomorrow = new Date("2026-09-14T08:00:00.000Z");
assert.ok(
  isOfferListedOnPos({ ...base, validFrom: tomorrow }, now, waiter),
  "future-dated offer is listed as scheduled"
);
assert.equal(posOfferStatus({ validFrom: tomorrow }, now), "scheduled");
assert.equal(posOfferStatus({ validFrom: new Date("2026-09-13T00:00:00.000Z") }, now), "active");

const yesterday = new Date("2026-09-12T23:59:59.000Z");
assert.equal(
  isOfferListedOnPos({ ...base, validTo: yesterday }, now, waiter),
  false,
  "expired offer is hidden"
);
assert.equal(isOfferListedOnPos({ ...base, isActive: false }, now, waiter), false);

console.log("offers.pos.test.ts: ok");
