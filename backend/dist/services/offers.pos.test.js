"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * POS offer visibility — run: cd backend && npx tsx src/services/offers.pos.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const pos_offer_visibility_1 = require("../lib/pos-offer-visibility");
const waiter = "staff-waiter-1";
const driver = "staff-delivery-1";
const now = new Date("2026-09-13T12:00:00.000Z");
const base = {
    isActive: true,
    validFrom: null,
    validTo: null,
    staffIds: [],
};
strict_1.default.deepEqual((0, pos_offer_visibility_1.offerStaffIds)({ staffIds: null }), []);
strict_1.default.ok((0, pos_offer_visibility_1.offerMatchesPosStaff)(base, waiter));
strict_1.default.ok((0, pos_offer_visibility_1.offerMatchesPosStaff)({ staffIds: [waiter] }, waiter));
strict_1.default.equal((0, pos_offer_visibility_1.offerMatchesPosStaff)({ staffIds: [waiter] }, driver), false);
strict_1.default.equal((0, pos_offer_visibility_1.offerMatchesPosStaff)({ staffIds: [waiter] }, null), false);
strict_1.default.ok((0, pos_offer_visibility_1.offerMatchesPosStaff)({ staffIds: [waiter] }, null, true), "owner sees targeted offers");
strict_1.default.ok((0, pos_offer_visibility_1.isOfferListedOnPos)(base, now, waiter), "all-user offer is visible");
strict_1.default.equal((0, pos_offer_visibility_1.isOfferListedOnPos)({ ...base, staffIds: [driver] }, now, waiter), false, "other staff's offer is hidden");
strict_1.default.ok((0, pos_offer_visibility_1.isOfferListedOnPos)({ ...base, staffIds: [waiter] }, now, waiter), "own targeted offer is visible");
const tomorrow = new Date("2026-09-14T08:00:00.000Z");
strict_1.default.ok((0, pos_offer_visibility_1.isOfferListedOnPos)({ ...base, validFrom: tomorrow }, now, waiter), "future-dated offer is listed as scheduled");
strict_1.default.equal((0, pos_offer_visibility_1.posOfferStatus)({ validFrom: tomorrow }, now), "scheduled");
strict_1.default.equal((0, pos_offer_visibility_1.posOfferStatus)({ validFrom: new Date("2026-09-13T00:00:00.000Z") }, now), "active");
const yesterday = new Date("2026-09-12T23:59:59.000Z");
strict_1.default.equal((0, pos_offer_visibility_1.isOfferListedOnPos)({ ...base, validTo: yesterday }, now, waiter), false, "expired offer is hidden");
strict_1.default.equal((0, pos_offer_visibility_1.isOfferListedOnPos)({ ...base, isActive: false }, now, waiter), false);
console.log("offers.pos.test.ts: ok");
//# sourceMappingURL=offers.pos.test.js.map