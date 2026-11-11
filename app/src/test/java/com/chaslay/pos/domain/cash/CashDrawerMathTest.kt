package com.chaslay.pos.domain.cash

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CashDrawerMathTest {

    @Test
    fun expectedCash_balancedExample() {
        val expected = calculateExpectedDrawerCents(
            openingFloatCents = 15_000,
            cashSalesCents = 31_850,
            cashTipsCents = 2_200,
            cashPayoutsCents = 4_250,
            cashRefundsCents = 0,
            manualFloatAdjustmentCents = 0,
        )
        assertEquals(44_800, expected)
        assertEquals(0, calculateVarianceCents(44_800, expected))
    }

    @Test
    fun cardTipsDoNotAffectExpected() {
        val expected = calculateExpectedDrawerCents(
            openingFloatCents = 15_000,
            cashSalesCents = 30_000,
            cashTipsCents = 0,
            cashPayoutsCents = 0,
            cashRefundsCents = 0,
            manualFloatAdjustmentCents = 0,
        )
        assertEquals(45_000, expected)
    }

    @Test
    fun manualFloatIncrease() {
        val expected = calculateExpectedDrawerCents(
            openingFloatCents = 15_000,
            cashSalesCents = 31_850,
            cashTipsCents = 2_200,
            cashPayoutsCents = 4_250,
            cashRefundsCents = 0,
            manualFloatAdjustmentCents = 5_000,
        )
        assertEquals(49_800, expected)
    }

    @Test
    fun parseCountedCashInput() {
        assertEquals(42_600L, parseCountedCashInputToCents("426.00"))
        assertEquals(42_600L, parseCountedCashInputToCents("426"))
        assertEquals(42_650L, parseCountedCashInputToCents("426.5"))
        assertNull(parseCountedCashInputToCents("-1"))
        assertNull(parseCountedCashInputToCents("abc"))
    }
}
