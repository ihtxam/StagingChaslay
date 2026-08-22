"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustTaxForOrderDiscount = adjustTaxForOrderDiscount;
exports.merchandiseBase = merchandiseBase;
exports.adjustReceiptVatForDiscount = adjustReceiptVatForDiscount;
const money_1 = require("@/lib/money");
/**
 * When prices are tax-exclusive and an order-level discount applies, adjust VAT:
 * - vatAfterDiscount true (default): tax scales with discounted net base — Swiss-compliant.
 * - vatAfterDiscount false: tax stays on pre-discount base; discount reduces total only.
 *
 * Gross (taxIncludedInPrice) pricing scales VAT proportionally in WebPOS bill discount;
 * this helper is skipped for gross in the backend (see webpos-bill-discount.ts).
 */
function adjustTaxForOrderDiscount(taxAmount, taxableBase, discount, opts) {
    const tax = (0, money_1.roundMoney2)(Number(taxAmount) || 0);
    if (opts.taxIncludedInPrice === true)
        return tax;
    if (opts.vatAfterDiscount === false)
        return tax;
    const base = (0, money_1.roundMoney2)(Number(taxableBase) || 0);
    const disc = (0, money_1.roundMoney2)(Math.max(0, Number(discount) || 0));
    if (tax <= 0 || base <= 0 || disc <= 0)
        return tax;
    const effectiveBase = (0, money_1.roundMoney2)(Math.max(0, base - Math.min(disc, base)));
    if (effectiveBase >= base)
        return tax;
    return (0, money_1.roundMoney2)(tax * (effectiveBase / base));
}
/** Merchandise base for order-level discount (net subtotal or gross incl. VAT). */
function merchandiseBase(totals, vatIncludedInPrice) {
    return vatIncludedInPrice
        ? (0, money_1.roundMoney2)(totals.subtotal + totals.tax)
        : (0, money_1.roundMoney2)(totals.subtotal);
}
/**
 * Receipt / stored tax after order-level remise.
 * Gross and net + vatAfterDiscount scale VAT with the discounted base (Swiss default).
 */
function adjustReceiptVatForDiscount(subtotal, taxAmount, discount, opts) {
    const net = (0, money_1.roundMoney2)(subtotal);
    const tax = (0, money_1.roundMoney2)(taxAmount);
    const disc = (0, money_1.roundMoney2)(Math.max(0, Number(discount) || 0));
    const vatIncluded = opts.vatIncludedInPrice === true;
    const vatAfterDiscount = opts.vatAfterDiscount !== false;
    if (disc <= 0)
        return { subtotal: net, taxAmount: tax };
    const merchandise = merchandiseBase({ subtotal: net, tax }, vatIncluded);
    if (merchandise <= 0)
        return { subtotal: net, taxAmount: tax };
    if (vatIncluded || vatAfterDiscount) {
        const afterDisc = (0, money_1.roundMoney2)(Math.max(0, merchandise - Math.min(disc, merchandise)));
        const factor = afterDisc / merchandise;
        const taxShare = (0, money_1.roundMoney2)(tax * factor);
        if (vatIncluded) {
            return { subtotal: (0, money_1.roundMoney2)(afterDisc - taxShare), taxAmount: taxShare };
        }
        return {
            subtotal: afterDisc,
            taxAmount: adjustTaxForOrderDiscount(tax, net, disc, {
                taxIncludedInPrice: false,
                vatAfterDiscount: true,
            }),
        };
    }
    return { subtotal: net, taxAmount: tax };
}
//# sourceMappingURL=tax-discount.js.map