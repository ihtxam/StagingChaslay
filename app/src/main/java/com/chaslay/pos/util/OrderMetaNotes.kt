package com.chaslay.pos.util

private val TICKET_NOTE_RE = Regex("""\[ticket:([^\]]+)\]""", RegexOption.IGNORE_CASE)
private val TAB_NOTE_RE = Regex("""\[tab:([^\]]+)\]""", RegexOption.IGNORE_CASE)

data class OrderMetaNotes(
    val ticketDisplay: String? = null,
    val tabNumber: String? = null
)

fun parseOrderMetaFromNotes(notes: String?): OrderMetaNotes {
    if (notes.isNullOrBlank()) return OrderMetaNotes()
    val ticket = TICKET_NOTE_RE.find(notes)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
    val tab = TAB_NOTE_RE.find(notes)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
    return OrderMetaNotes(
        ticketDisplay = ticket?.let { normalizeTicketShout(it) },
        tabNumber = tab
    )
}

fun formatOrderMetaTicketTag(display: String): String {
    val cleaned = display.trim().replace("[", "").replace("]", "")
    return "[ticket:$cleaned]"
}

fun formatOrderMetaTabTag(tab: String): String {
    val cleaned = tab.trim().replace("[", "").replace("]", "")
    return "[tab:$cleaned]"
}

private fun normalizeTicketShout(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return trimmed
    return if (trimmed.startsWith("#") || trimmed.startsWith("D-", ignoreCase = true)) {
        trimmed
    } else if (trimmed.all { it.isDigit() }) {
        "#$trimmed"
    } else {
        trimmed
    }
}
