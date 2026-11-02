package com.chaslay.pos.util

import java.util.Locale
import kotlin.math.ceil

/** Suggested cash tender shortcuts ≥ amount due (Swiss-friendly note ladder). */
fun suggestQuickCashTenderAmounts(amountDue: Double, currencyCode: String = "CHF"): List<Double> {
    val due = roundMoney2(amountDue.coerceAtLeast(0.0))
    if (due <= 0.001) return emptyList()

    val notes = standardNotesForCurrency(currencyCode)
    val out = linkedSetOf<Double>()

    val hasFraction = due % 1.0 > 0.001
    if (hasFraction) {
        out.add(ceil(due))
    } else {
        out.add(due)
    }

    for (note in notes) {
        if (note + 0.001 >= due) out.add(note)
    }

    return out.sorted().take(5)
}

private fun standardNotesForCurrency(currencyCode: String): List<Double> {
    return when (currencyCode.uppercase(Locale.US)) {
        "CHF", "EUR" -> listOf(5.0, 10.0, 20.0, 50.0, 100.0, 200.0)
        else -> listOf(5.0, 10.0, 20.0, 50.0, 100.0)
    }
}

private fun roundMoney2(amount: Double): Double =
    kotlin.math.round((amount + 1e-9) * 100.0) / 100.0
