"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offerStaffIds = offerStaffIds;
exports.offerMatchesPosStaff = offerMatchesPosStaff;
exports.isOfferListedOnPos = isOfferListedOnPos;
exports.posOfferStatus = posOfferStatus;
function offerStaffIds(offer) {
    return Array.isArray(offer.staffIds) ? offer.staffIds.map(String).filter(Boolean) : [];
}
/** Empty staffIds = every POS user. Targeted offers match that staff (or owner overview). */
function offerMatchesPosStaff(offer, staffId, ownerSeesAll = false) {
    const ids = offerStaffIds(offer);
    if (!ids.length)
        return true;
    if (ownerSeesAll && !staffId)
        return true;
    if (!staffId)
        return false;
    return ids.includes(staffId);
}
/** POS bulletin: active today or not-yet-started (scheduled). Ignores happy-hour clocks. */
function isOfferListedOnPos(offer, at, staffId, ownerSeesAll = false) {
    if (!offer.isActive)
        return false;
    const validTo = offer.validTo ? new Date(offer.validTo) : null;
    if (validTo && !Number.isNaN(validTo.getTime()) && at > validTo)
        return false;
    return offerMatchesPosStaff(offer, staffId, ownerSeesAll);
}
function posOfferStatus(offer, at) {
    const validFrom = offer.validFrom ? new Date(offer.validFrom) : null;
    if (validFrom && !Number.isNaN(validFrom.getTime()) && at < validFrom)
        return "scheduled";
    return "active";
}
//# sourceMappingURL=pos-offer-visibility.js.map