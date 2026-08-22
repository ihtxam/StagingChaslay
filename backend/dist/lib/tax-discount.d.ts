/**
 * When prices are tax-exclusive and an order-level discount applies, adjust VAT:
 * - vatAfterDiscount true (default): tax scales with discounted net base — Swiss-compliant.
 * - vatAfterDiscount false: tax stays on pre-discount base; discount reduces total only.
 *
 * Gross (taxIncludedInPrice) pricing scales VAT proportionally in WebPOS bill discount;
 * this helper is skipped for gross in the backend (see webpos-bill-discount.ts).
 */
export declare function adjustTaxForOrderDiscount(taxAmount: number, taxableBase: number, discount: number, opts: {
    taxIncludedInPrice?: boolean;
    vatAfterDiscount?: boolean;
}): number;
/** Merchandise base for order-level discount (net subtotal or gross incl. VAT). */
export declare function merchandiseBase(totals: {
    subtotal: number;
    tax: number;
}, vatIncludedInPrice: boolean): number;
/**
 * Receipt / stored tax after order-level remise.
 * Gross and net + vatAfterDiscount scale VAT with the discounted base (Swiss default).
 */
export declare function adjustReceiptVatForDiscount(subtotal: number, taxAmount: number, discount: number, opts: {
    vatIncludedInPrice?: boolean;
    vatAfterDiscount?: boolean;
}): {
    subtotal: number;
    taxAmount: number;
};
//# sourceMappingURL=tax-discount.d.ts.map