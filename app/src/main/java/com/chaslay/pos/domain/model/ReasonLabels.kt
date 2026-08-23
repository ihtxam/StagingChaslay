package com.chaslay.pos.domain.model

data class RefundReasonOption(
    val id: String,
    val en: String,
    val fr: String,
    val de: String
) {
    fun label(languageCode: String): String = when (AppLanguage.fromCode(languageCode)) {
        AppLanguage.FRENCH -> fr
        AppLanguage.GERMAN -> de
        else -> en
    }
}

/** Predefined refund reasons aligned with WebPOS / backend POS_REFUND_REASONS. */
object RefundReasonLabels {
    val options: List<RefundReasonOption> = listOf(
        RefundReasonOption(
            id = "dont_wanna_eat",
            en = "Don't wanna eat",
            fr = "Ne veut plus manger",
            de = "Möchte nicht essen"
        ),
        RefundReasonOption(
            id = "long_serving_time",
            en = "Long serving time",
            fr = "Temps de service trop long",
            de = "Lange Wartezeit"
        ),
        RefundReasonOption(
            id = "wrong_order",
            en = "Wrong order",
            fr = "Mauvaise commande",
            de = "Falsche Bestellung"
        ),
        RefundReasonOption(
            id = "other",
            en = "Other",
            fr = "Autre",
            de = "Sonstiges"
        )
    )

    fun localizedOptions(languageCode: String): List<Pair<String, String>> =
        options.map { it.id to it.label(languageCode) }

    fun resolveReason(languageCode: String, reasonId: String, customText: String): String {
        if (reasonId == "other") return customText.trim().take(500)
        return options.find { it.id == reasonId }?.en?.take(500)
            ?: customText.trim().take(500)
    }
}

/** True when the transaction originated from an online / aggregator channel. */
fun isThirdPartyOrder(order: com.chaslay.pos.data.local.entity.TransactionEntity): Boolean {
    val notes = order.notes?.lowercase().orEmpty()
    return order.userName.equals("Online", ignoreCase = true) ||
        notes.contains("online order") ||
        notes.contains("justeat") ||
        notes.contains("uber eats") ||
        notes.contains("deliveroo") ||
        notes.contains("third-party") ||
        notes.contains("third party") ||
        notes.contains("aggregator")
}
