package com.chaslay.pos.printer

import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.GiftCardProducts
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.VatBreakdownRow

data class ReceiptPrintContext(
    val orderNumber: String? = null,
    val serviceType: ServiceType = ServiceType.TAKEAWAY,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val tableName: String? = null,
    val paymentMethod: PaymentMethod? = null,
    val amountPaid: Double? = null,
    val staffName: String = "Staff",
    val sourceLabel: String = "POS",
    val isProvisional: Boolean = paymentMethod == null,
    val loyaltyPointsEarned: Int? = null,
    val loyaltyPointsBalance: Int? = null
)

object ReceiptVatCalculator {
    fun isGiftCardProductId(productId: Long?): Boolean =
        productId == GiftCardProducts.SELL_PRODUCT_ID ||
            productId == GiftCardProducts.RELOAD_PRODUCT_ID

    /** VAT row for a gift-card sell/reload amount on order receipts (not barcode sale). */
    fun vatRowForGiftCardAmount(
        amount: Double,
        rate: Double,
        vatIncluded: Boolean
    ): VatBreakdownRow? {
        if (amount <= 0.0 || rate <= 0.0) return null
        return if (vatIncluded) {
            val brut = amount
            val net = brut / (1.0 + rate / 100.0)
            val tva = brut - net
            VatBreakdownRow(
                label = "${formatRate(rate)}%",
                rate = rate,
                net = net,
                tva = tva,
                brut = brut
            )
        } else {
            val net = amount
            val tva = net * rate / 100.0
            VatBreakdownRow(
                label = "${formatRate(rate)}%",
                rate = rate,
                net = net,
                tva = tva,
                brut = net + tva
            )
        }
    }

    fun mergeVatRowsByRate(rows: List<VatBreakdownRow>): List<VatBreakdownRow> =
        rows.groupBy { it.rate }
            .map { (rate, group) ->
                VatBreakdownRow(
                    label = "${formatRate(rate)}%",
                    rate = rate,
                    net = group.sumOf { it.net },
                    tva = group.sumOf { it.tva },
                    brut = group.sumOf { it.brut }
                )
            }
            .sortedByDescending { it.rate }

    fun vatRowsFromCartItems(items: List<CartItem>, discountFactor: Double = 1.0): List<VatBreakdownRow> =
        vatRowsFromCartItems(items, discountFactor, giftCardRate = 0.0, vatIncludedInPrice = true)

    /** Merchandise VAT plus gift-card sell/reload lines (taxRate 0 in cart, VAT on receipt). */
    fun vatRowsFromCartItems(
        items: List<CartItem>,
        discountFactor: Double,
        giftCardRate: Double,
        vatIncludedInPrice: Boolean
    ): List<VatBreakdownRow> {
        val productRows = items.filter { !it.isGiftCardLine && it.taxRate > 0.0 }
            .groupBy { it.taxRate }
            .map { (rate, groupItems) ->
                val brut = groupItems.sumOf { it.lineTotal } * discountFactor
                val net = brut / (1.0 + rate / 100.0)
                val tva = brut - net
                VatBreakdownRow(
                    label = "${formatRate(rate)}%",
                    rate = rate,
                    net = net,
                    tva = tva,
                    brut = brut
                )
            }
        val giftAmount = items.filter { it.isGiftCardLine }.sumOf { it.lineTotal } * discountFactor
        val giftRow = vatRowForGiftCardAmount(giftAmount, giftCardRate, vatIncludedInPrice)
        return mergeVatRowsByRate(productRows + listOfNotNull(giftRow))
    }

    fun vatRowsFromTransactionItems(
        items: List<com.chaslay.pos.data.local.entity.TransactionItemEntity>,
        discountFactor: Double = 1.0
    ): List<VatBreakdownRow> =
        vatRowsFromTransactionItems(items, discountFactor, giftCardRate = 0.0, vatIncludedInPrice = true)

    /** Merchandise VAT plus persisted gift-card sell/reload lines. */
    fun vatRowsFromTransactionItems(
        items: List<com.chaslay.pos.data.local.entity.TransactionItemEntity>,
        discountFactor: Double,
        giftCardRate: Double,
        vatIncludedInPrice: Boolean
    ): List<VatBreakdownRow> {
        val productRows = items.filter { !isGiftCardProductId(it.productId) && it.taxRate > 0.0 }
            .groupBy { it.taxRate }
            .map { (rate, groupItems) ->
                val brut = groupItems.sumOf { it.lineTotal } * discountFactor
                val net = brut / (1.0 + rate / 100.0)
                val tva = brut - net
                VatBreakdownRow(
                    label = "${formatRate(rate)}%",
                    rate = rate,
                    net = net,
                    tva = tva,
                    brut = brut
                )
            }
        val giftAmount = items.filter { isGiftCardProductId(it.productId) }
            .sumOf { it.lineTotal } * discountFactor
        val giftRow = vatRowForGiftCardAmount(giftAmount, giftCardRate, vatIncludedInPrice)
        return mergeVatRowsByRate(productRows + listOfNotNull(giftRow))
    }

    fun modifierSummaryFromNotes(notes: String?): String? {
        if (notes.isNullOrBlank()) return null
        val names = notes.lines().mapNotNull { line ->
            Regex("^(\\d+)x\\s+(.+)$").find(line.trim())?.groupValues?.get(2)
        }
        return names.takeIf { it.isNotEmpty() }?.joinToString(", ")
    }

    fun modifierSummary(item: CartItem): String? {
        val names = buildList {
            item.modifiers.forEach { add(it.name) }
            item.addons.forEach { add(it.name) }
        }
        return names.takeIf { it.isNotEmpty() }?.joinToString(", ")
            ?: modifierSummaryFromNotes(item.notes)
    }

    fun formatRate(rate: Double): String =
        if (rate % 1.0 == 0.0) rate.toInt().toString() else String.format("%.1f", rate)
}

/** Scale receipt VAT rows when discounts reduce the tax base (gross always; net when vatAfterDiscount). */
fun receiptDiscountFactor(
    vatIncludedInPrice: Boolean,
    vatAfterDiscount: Boolean,
    merchandiseBase: Double,
    discountAmount: Double
): Double {
    if (discountAmount <= 0.0 || merchandiseBase <= 0.0) return 1.0
    if (!vatIncludedInPrice && !vatAfterDiscount) return 1.0
    return ((merchandiseBase - discountAmount) / merchandiseBase).coerceIn(0.0, 1.0)
}
