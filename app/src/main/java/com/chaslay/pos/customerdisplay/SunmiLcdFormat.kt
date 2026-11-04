package com.chaslay.pos.customerdisplay

private const val LCD_LINE_MAX = 20

private fun truncateLcdLine(value: String): String {
    val collapsed = value.replace('\n', ' ').trim()
    if (collapsed.length <= LCD_LINE_MAX) return collapsed
    return collapsed.take(LCD_LINE_MAX - 1) + "…"
}

private fun formatMoney(currency: String, amount: Double): String {
    val n = if (amount.isFinite()) amount else 0.0
    return if (currency.equals("CHF", ignoreCase = true)) {
        "CHF ${"%.2f".format(java.util.Locale.US, n)}"
    } else {
        "$currency ${"%.2f".format(java.util.Locale.US, n)}"
    }
}

data class SunmiLcdLines(
    val topText: String,
    val bottomText: String,
    val clear: Boolean = false,
)

fun formatSunmiLcdLines(
    phase: CustomerDisplayPhase,
    currency: String,
    total: Double,
    lines: List<CustomerDisplayLine>,
    merchantName: String? = null,
): SunmiLcdLines {
    val totalLabel = formatMoney(currency, total)
    val last = lines.lastOrNull()

    if (phase == CustomerDisplayPhase.idle && lines.isEmpty()) {
        val welcome = truncateLcdLine(merchantName ?: "Welcome")
        return SunmiLcdLines(topText = welcome, bottomText = formatMoney(currency, 0.0))
    }

    if (phase == CustomerDisplayPhase.thankyou) {
        return SunmiLcdLines(topText = "Thank you", bottomText = totalLabel)
    }

    if (phase == CustomerDisplayPhase.payment) {
        return SunmiLcdLines(topText = "TOTAL", bottomText = totalLabel)
    }

    if (last != null) {
        val qtyPrefix = if (last.qty > 1) "${last.qty.toInt()}x " else ""
        val top = truncateLcdLine("$qtyPrefix${last.name}")
        return SunmiLcdLines(topText = top, bottomText = totalLabel)
    }

    return SunmiLcdLines(topText = "TOTAL", bottomText = totalLabel)
}
