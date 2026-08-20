package com.chaslay.pos.domain.model

/** Membership / gift card attached to the active sale (cloud lookup). */
data class MembershipPlanInfo(
    val id: String,
    val label: String,
    val type: String,
    val discountPercent: Double? = null,
    val stampsRequired: Int? = null,
    val rewardProductId: String? = null,
    val active: Boolean = true
)

/** Membership / gift card attached to the active sale (cloud lookup). */
data class AttachedMembership(
    val cardId: String,
    val cardNumber: String,
    val customerName: String?,
    val customerId: String?,
    val pointsBalance: Int,
    val giftBalance: Double,
    val membershipEnabled: Boolean,
    val membershipPlanId: String? = null,
    val membershipPlan: MembershipPlanInfo? = null,
    val stampCount: Int = 0
)

/** Stored-value gift card on the sale (separate from membership identity). */
data class AttachedGiftCard(
    val cardId: String,
    val cardNumber: String,
    val balance: Double
)

data class LoyaltyProgramSettings(
    val enabled: Boolean = false,
    val earnPointsPerChf: Double = LoyaltyMath.DEFAULT_EARN_POINTS_PER_CHF.toDouble(),
    val redeemPointsPerChf: Int = LoyaltyMath.DEFAULT_REDEEM_POINTS_PER_CHF
) {
    val redeemThreshold: Int
        get() = redeemPointsPerChf.coerceAtLeast(1)
}

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
    val holderName: String? = null,
    val ecardEmail: String? = null,
    /** print | email | both — e-gift sell only */
    val deliveryMethod: String? = null
)

object GiftCardProducts {
    const val SELL_PRODUCT_ID = -9001L
    const val RELOAD_PRODUCT_ID = -9002L
}

object LoyaltyMath {
    const val REDEEM_THRESHOLD_POINTS = 100
    const val DEFAULT_EARN_POINTS_PER_CHF = 1
    const val DEFAULT_REDEEM_POINTS_PER_CHF = 100

    fun computeEarnPoints(
        paidSubtotalChf: Double,
        earnRate: Double = DEFAULT_EARN_POINTS_PER_CHF.toDouble()
    ): Int =
        kotlin.math.floor(paidSubtotalChf.coerceAtLeast(0.0) * earnRate.coerceAtLeast(0.0)).toInt()

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
