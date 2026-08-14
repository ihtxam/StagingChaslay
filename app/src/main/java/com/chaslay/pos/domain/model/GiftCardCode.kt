package com.chaslay.pos.domain.model

/** Parse plain gift-card codes or /gift/{code} URLs from scanner input. */
object GiftCardCode {
    fun parse(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            val match = Regex("/gift/([^/?#\\s]+)", RegexOption.IGNORE_CASE).find(trimmed)
            if (match != null) return match.groupValues[1].trim()
        }
        val inline = Regex("/gift/([^/?#\\s]+)", RegexOption.IGNORE_CASE).find(trimmed)
        if (inline != null) return inline.groupValues[1].trim()
        return trimmed
    }

    fun qrPayload(code: String): String = parse(code).ifBlank { code.trim() }
}
