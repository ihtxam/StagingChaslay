package com.chaslay.pos.domain.model

import java.util.Locale

data class PaymentTender(val method: PaymentMethod, val amount: Double)

/** Persist mixed tenders in transaction notes so reprints match checkout. */
object PaymentTenderNotes {
    private val LINE = Regex(
        """^Tender\s+([a-z_]+):\s*([0-9]+(?:\.[0-9]+)?)$""",
        RegexOption.IGNORE_CASE
    )

    fun encodeLines(tenders: List<PaymentTender>): List<String> =
        tenders.filter { it.amount > 0.001 }.map {
            String.format(Locale.US, "Tender %s: %.2f", methodKey(it.method), it.amount)
        }

    fun parse(notes: String?): List<PaymentTender> =
        notes?.lineSequence()
            ?.map { it.trim() }
            ?.mapNotNull { line ->
                val match = LINE.matchEntire(line) ?: return@mapNotNull null
                val method = fromKey(match.groupValues[1]) ?: return@mapNotNull null
                val amount = match.groupValues[2].toDoubleOrNull()?.takeIf { it > 0.001 }
                    ?: return@mapNotNull null
                PaymentTender(method, amount)
            }
            ?.toList()
            .orEmpty()

    fun isTenderLine(line: String): Boolean = LINE.matches(line.trim())

    fun toPublishRows(tenders: List<PaymentTender>): List<Map<String, Any>> =
        tenders.map { mapOf("method" to methodKey(it.method), "amount" to it.amount) }

    fun methodKey(method: PaymentMethod): String = when (method) {
        PaymentMethod.CASH -> "cash"
        PaymentMethod.CARD -> "card"
        PaymentMethod.TAP_TO_PAY -> "tap_to_pay"
        PaymentMethod.ADYEN_TERMINAL -> "terminal"
        PaymentMethod.PAY_LATER -> "pay_later"
        PaymentMethod.INVOICE -> "invoice"
        PaymentMethod.GIFT_CARD -> "gift_card"
    }

    private fun fromKey(key: String): PaymentMethod? = when (key.lowercase(Locale.US).replace('-', '_')) {
        "cash" -> PaymentMethod.CASH
        "card" -> PaymentMethod.CARD
        "tap_to_pay" -> PaymentMethod.TAP_TO_PAY
        "terminal", "adyen_terminal" -> PaymentMethod.ADYEN_TERMINAL
        "pay_later" -> PaymentMethod.PAY_LATER
        "invoice" -> PaymentMethod.INVOICE
        "gift_card", "giftcard" -> PaymentMethod.GIFT_CARD
        else -> null
    }
}
