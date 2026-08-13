package com.chaslay.pos.domain.model

/** Membership / gift card attached to the active sale (cloud lookup). */
data class AttachedMembership(
    val cardId: String,
    val cardNumber: String,
    val customerName: String?,
    val customerId: String?,
    val pointsBalance: Int,
    val giftBalance: Double,
    val membershipEnabled: Boolean
)

enum class GiftCardOp {
    SELL,
    RELOAD
}

/** Metadata for gift-card sell/reload lines in the cart (credited after payment). */
data class GiftCardLineMeta(
    val op: GiftCardOp,
    val cardNumber: String,
    val cardId: String? = null,
    val mediaType: String = "physical",
    val amount: Double,
    val holderName: String? = null
)

object GiftCardProducts {
    const val SELL_PRODUCT_ID = -9001L
    const val RELOAD_PRODUCT_ID = -9002L
}

object LoyaltyMath {
    const val REDEEM_THRESHOLD_POINTS = 100
    const val DEFAULT_EARN_POINTS_PER_CHF = 1
    const val DEFAULT_REDEEM_POINTS_PER_CHF = 100

    fun computeEarnPoints(paidSubtotalChf: Double, earnRate: Int = DEFAULT_EARN_POINTS_PER_CHF): Int =
        kotlin.math.floor(paidSubtotalChf.coerceAtLeast(0.0) * earnRate).toInt()

    fun computeCashDiscount(points: Int, redeemRate: Int = DEFAULT_REDEEM_POINTS_PER_CHF): Double {
        val rate = redeemRate.coerceAtLeast(1)
        return kotlin.math.floor(points.toDouble() / rate).coerceAtLeast(0.0)
    }

    fun maxRedeemablePoints(payableChf: Double, balance: Int, redeemRate: Int = DEFAULT_REDEEM_POINTS_PER_CHF): Int {
        val rate = redeemRate.coerceAtLeast(1)
        val maxByTotal = kotlin.math.floor(payableChf.coerceAtLeast(0.0) * rate).toInt()
        return minOf(balance.coerceAtLeast(0), maxByTotal)
    }

    fun normalizeRfidUid(raw: String): String =
        raw.trim().replace(Regex("[\\s:_\\-]+"), "").uppercase()
}
