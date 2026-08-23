package com.chaslay.pos.util

object OrderNumberFormat {
    private val OPAQUE_ORDER_RE = Regex("^(WP|DI)-", RegexOption.IGNORE_CASE)

    fun guestOrderNumber(
        orderNumber: String?,
        orderDisplay: String? = null,
        tabNumber: String? = null
    ): String {
        val shout = orderDisplay?.trim().orEmpty()
        if (shout.isNotEmpty() && !OPAQUE_ORDER_RE.containsMatchIn(shout)) {
            return normalizeShout(shout)
        }
        val tab = tabNumber?.trim()?.removePrefix("#").orEmpty()
        if (tab.isNotEmpty()) return "#$tab"
        val raw = orderNumber?.trim().orEmpty()
        if (raw.isEmpty() || OPAQUE_ORDER_RE.containsMatchIn(raw)) return ""
        return raw
    }

    fun formatCheckoutOrderRef(
        orderNumber: String?,
        kitchenNumber: String? = null,
        tabNumber: String? = null
    ): String {
        val primary = guestOrderNumber(orderNumber, kitchenNumber, tabNumber)
        if (primary.isEmpty()) return ""
        val kitchen = kitchenNumber?.trim().orEmpty().removePrefix("#")
        val kitchenHash = if (kitchen.isNotEmpty()) "#$kitchen" else ""
        val raw = orderNumber?.trim().orEmpty()
        if (
            kitchenHash.isNotEmpty() &&
            !kitchenHash.equals(primary, ignoreCase = true) &&
            raw.startsWith("TX-", ignoreCase = true) &&
            primary.equals(raw, ignoreCase = true)
        ) {
            return "$primary · Kitchen $kitchenHash"
        }
        return primary
    }

    private fun normalizeShout(value: String): String {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return trimmed
        return if (trimmed.startsWith("#")) trimmed else "#${trimmed.removePrefix("#")}"
    }
}
