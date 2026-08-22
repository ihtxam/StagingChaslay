/** Stored on products.combo_items (slot-based, with legacy fixed-item support). */
export type ComboOptionStored = {
    productId: string;
    /** Surcharge on top of combo base price (0 = included). */
    extraPrice?: number;
};
export type ComboSlotStored = {
    id: string;
    name: string;
    minPick?: number;
    maxPick?: number;
    options?: ComboOptionStored[];
    /** Legacy fixed component */
    productId?: string;
    quantity?: number;
};
export type NormalizedComboSlot = {
    id: string;
    name: string;
    minPick: number;
    maxPick: number;
    options: Array<{
        productId: string;
        extraPrice: number;
    }>;
};
export declare function isSlotShaped(row: any): boolean;
/** Normalize legacy fixed items and new slots into a single slot list. */
export declare function normalizeComboSlots(raw: unknown): NormalizedComboSlot[];
/** Sanitize combo slots from merchant API before save. */
export declare function sanitizeComboSlotsInput(raw: unknown): ComboSlotStored[];
//# sourceMappingURL=combo.d.ts.map