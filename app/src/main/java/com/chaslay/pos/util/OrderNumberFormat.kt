package com.chaslay.pos.util

import com.chaslay.pos.data.local.entity.TransactionEntity

object OrderNumberFormat {
    private val OPAQUE_ORDER_RE = Regex("^(WP|DI|POS)-", RegexOption.IGNORE_CASE)
    private val SHORT_WEB_RE = Regex("^WEB-(\\d{1,6})$", RegexOption.IGNORE_CASE)
    private val SCOPED_WEB_RE = Regex("^WEB-([A-Z0-9]{4})-(\\d{1,6})$", RegexOption.IGNORE_CASE)
    private val LEGACY_WEB_RE = Regex("^WEB-(\\d{10,})(?:-([A-F0-9]{4,8}))?$", RegexOption.IGNORE_CASE)
    private val TX_RE = Regex("^TX-", RegexOption.IGNORE_CASE)

    fun guestOrderNumber(
        orderNumber: String?,
        orderDisplay: String? = null,
        tabNumber: String? = null
    ): String {
        val raw = orderNumber?.trim().orEmpty()
        if (TX_RE.containsMatchIn(raw) || raw.startsWith("WEB", ignoreCase = true)) {
            val formatted = formatOrderNumberDisplay(raw)
            if (formatted.isNotEmpty()) return formatted
        }
        val shout = orderDisplay?.trim().orEmpty()
        if (shout.isNotEmpty() && !OPAQUE_ORDER_RE.containsMatchIn(shout)) {
            return normalizeShout(shout)
        }
        val tab = tabNumber?.trim()?.removePrefix("#").orEmpty()
        if (tab.isNotEmpty()) return "#$tab"
        if (raw.isEmpty() || OPAQUE_ORDER_RE.containsMatchIn(raw)) return ""
        val formatted = formatOrderNumberDisplay(raw)
        if (formatted.isNotEmpty()) return formatted
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
            TX_RE.containsMatchIn(raw) &&
            primary.equals(raw, ignoreCase = true)
        ) {
            return "$primary · Kitchen $kitchenHash"
        }
        return primary
    }

    fun displayForTransaction(transaction: TransactionEntity): String {
        val meta = parseOrderMetaFromNotes(transaction.notes)
        val tab = meta.tabNumber ?: transaction.guestCount?.takeIf { it > 0 }?.toString()
        return guestOrderNumber(
            orderNumber = transaction.transactionNumber,
            orderDisplay = meta.ticketDisplay,
            tabNumber = tab
        ).ifBlank {
            formatOrderNumberDisplay(transaction.transactionNumber)
                .ifBlank { transaction.transactionNumber }
        }
    }

    fun formatOrderNumberDisplay(orderNumber: String?): String {
        val n = orderNumber?.trim().orEmpty()
        if (n.isEmpty()) return n
        if (SHORT_WEB_RE.matches(n) || SCOPED_WEB_RE.matches(n)) return n
        val legacy = LEGACY_WEB_RE.find(n)
        if (legacy != null) {
            val suffix = legacy.groupValues.getOrNull(2)
            if (!suffix.isNullOrBlank()) return "WEB-$suffix"
            val ts = legacy.groupValues.getOrNull(1).orEmpty()
            return if (ts.length >= 8) "WEB-${ts.takeLast(8)}" else n
        }
        if (TX_RE.containsMatchIn(n)) {
            val parts = n.split('-')
            val tail = parts.lastOrNull()?.trim().orEmpty()
            if (tail.length in 1..6 && tail.all { it.isDigit() }) return "#$tail"
            if (parts.size >= 2) {
                val mid = parts[parts.size - 2]
                if (mid.length >= 4 && mid.all { it.isDigit() }) return "#${mid.takeLast(4)}"
            }
        }
        if (n.startsWith("P-", ignoreCase = true) && n.length > 2) {
            return "#${n.removePrefix("P-").takeLast(4)}"
        }
        return n
    }

    private fun normalizeShout(value: String): String {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return trimmed
        return if (trimmed.startsWith("#")) trimmed else "#${trimmed.removePrefix("#")}"
    }
}
