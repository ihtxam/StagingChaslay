package com.chaslay.pos.domain.cash

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Expected cash in drawer (cents): float + cash sales + cash tips − payouts − refunds + manual float adj.
 * Card tips are excluded via [cashTipsCents] (pass 0 when tips were card-only).
 */
fun calculateExpectedDrawerCents(
    openingFloatCents: Long,
    cashSalesCents: Long,
    cashTipsCents: Long,
    cashPayoutsCents: Long,
    cashRefundsCents: Long,
    manualFloatAdjustmentCents: Long,
): Long =
    openingFloatCents +
        cashSalesCents +
        cashTipsCents -
        cashPayoutsCents -
        cashRefundsCents +
        manualFloatAdjustmentCents

/** Counted minus expected; positive = over, negative = short. */
fun calculateVarianceCents(countedCashCents: Long, expectedCashCents: Long): Long =
    countedCashCents - expectedCashCents

/** Parses a counted-cash field (e.g. "426.00") to cents, or null if invalid or negative. */
fun parseCountedCashInputToCents(input: String): Long? {
    val trimmed = input.trim()
    if (trimmed.isEmpty()) return null
    return try {
        val amount = BigDecimal(trimmed)
        if (amount.signum() < 0) return null
        amount
            .multiply(BigDecimal(100))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact()
    } catch (_: Exception) {
        null
    }
}
