export type PosOfferStatus = "active" | "scheduled";
export declare function offerStaffIds(offer: {
    staffIds?: string[] | null;
}): string[];
/** Empty staffIds = every POS user. Targeted offers match that staff (or owner overview). */
export declare function offerMatchesPosStaff(offer: {
    staffIds?: string[] | null;
}, staffId: string | null, ownerSeesAll?: boolean): boolean;
/** POS bulletin: active today or not-yet-started (scheduled). Ignores happy-hour clocks. */
export declare function isOfferListedOnPos(offer: {
    isActive: boolean;
    validFrom?: Date | string | null;
    validTo?: Date | string | null;
    staffIds?: string[] | null;
}, at: Date, staffId: string | null, ownerSeesAll?: boolean): boolean;
export declare function posOfferStatus(offer: {
    validFrom?: Date | string | null;
}, at: Date): PosOfferStatus;
//# sourceMappingURL=pos-offer-visibility.d.ts.map