package com.chaslay.pos.domain

import com.chaslay.pos.domain.model.CartSummary
import kotlin.math.max
import kotlin.math.min

/** Merchandise base used for order-level % / fixed discount. */
fun cartMerchandiseBase(cart: CartSummary): Double {
    return if (cart.vatIncludedInPrice) {
        roundMoney(cart.netSubtotal + cart.let {
            // raw tax before order discount adjustment
            it.items.sumOf { item -> item.lineTax }
        })
    } else {
        cart.netSubtotal
    }
}

/** Resolved order discount amount capped to merchandise (matches WebPOS resolveBillDiscountAmount). */
fun resolveBillDiscountAmount(cart: CartSummary, percent: Double, amount: Double): Double {
    val merchandise = cartMerchandiseBase(cart)
    if (merchandise <= 0.0) return 0.0
    val pct = max(0.0, percent)
    val fixed = max(0.0, amount)
    return when {
        pct > 0.0 -> roundMoney(merchandise * min(100.0, pct) / 100.0)
        fixed > 0.0 -> roundMoney(min(fixed, merchandise))
        else -> 0.0
    }
}

fun resolveCartBillDiscountAmount(cart: CartSummary): Double =
    resolveBillDiscountAmount(cart, cart.discountPercent, cart.discountAmount)

/** Merge two table/cart discounts — max percent or max fixed (never sum). */
fun mergeBillDiscounts(
    srcPercent: Double,
    srcAmount: Double,
    tgtPercent: Double,
    tgtAmount: Double
): Pair<Double, Double> {
    val srcHas = srcPercent > 0.0 || srcAmount > 0.0
    val tgtHas = tgtPercent > 0.0 || tgtAmount > 0.0
    if (!srcHas) return tgtPercent to tgtAmount
    if (!tgtHas) return srcPercent to srcAmount
    if (srcPercent > 0.0 || tgtPercent > 0.0) {
        return max(srcPercent, tgtPercent) to 0.0
    }
    return 0.0 to roundMoney(max(srcAmount, tgtAmount))
}

fun clampBillDiscountToCart(cart: CartSummary, percent: Double, amount: Double): Pair<Double, Double> {
    val pct = max(0.0, percent).coerceAtMost(100.0)
    val merch = cartMerchandiseBase(cart)
    val fixed = if (amount > 0.0) roundMoney(min(max(0.0, amount), merch)) else 0.0
    return when {
        pct > 0.0 -> pct to 0.0
        fixed > 0.0 -> 0.0 to fixed
        else -> 0.0 to 0.0
    }
}

private fun roundMoney(value: Double): Double =
    kotlin.math.round(value * 100.0) / 100.0
