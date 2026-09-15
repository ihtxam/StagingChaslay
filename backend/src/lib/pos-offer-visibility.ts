export type PosOfferStatus = "active" | "scheduled";

export function offerStaffIds(offer: { staffIds?: string[] | null }): string[] {
  return Array.isArray(offer.staffIds) ? offer.staffIds.map(String).filter(Boolean) : [];
}

/** Empty staffIds = every POS user. Targeted offers match that staff (or owner overview). */
export function offerMatchesPosStaff(
  offer: { staffIds?: string[] | null },
  staffId: string | null,
  ownerSeesAll = false
): boolean {
  const ids = offerStaffIds(offer);
  if (!ids.length) return true;
  if (ownerSeesAll && !staffId) return true;
  if (!staffId) return false;
  return ids.includes(staffId);
}

/** POS bulletin: active today or not-yet-started (scheduled). Ignores happy-hour clocks. */
export function isOfferListedOnPos(
  offer: {
    isActive: boolean;
    validFrom?: Date | string | null;
    validTo?: Date | string | null;
    staffIds?: string[] | null;
  },
  at: Date,
  staffId: string | null,
  ownerSeesAll = false
): boolean {
  if (!offer.isActive) return false;
  const validTo = offer.validTo ? new Date(offer.validTo) : null;
  if (validTo && !Number.isNaN(validTo.getTime()) && at > validTo) return false;
  return offerMatchesPosStaff(offer, staffId, ownerSeesAll);
}

export function posOfferStatus(
  offer: { validFrom?: Date | string | null },
  at: Date
): PosOfferStatus {
  const validFrom = offer.validFrom ? new Date(offer.validFrom) : null;
  if (validFrom && !Number.isNaN(validFrom.getTime()) && at < validFrom) return "scheduled";
  return "active";
}
