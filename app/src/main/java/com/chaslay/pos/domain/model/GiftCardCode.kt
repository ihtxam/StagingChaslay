package com.chaslay.pos.domain.model

/** Parse plain gift-card codes or /gift/{code} URLs from scanner input. */
object GiftCardCode {
    private val ECARD_BODY = Regex("""EC[-' ]?([0-9A-F]{6,12})""", RegexOption.IGNORE_CASE)

    fun parse(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            val match = Regex("/gift/([^/?#\\s]+)", RegexOption.IGNORE_CASE).find(trimmed)
            if (match != null) {
                val fromUrl = match.groupValues[1].trim()
                val ec = ECARD_BODY.find(fromUrl)
                if (ec != null) return "EC-${ec.groupValues[1].uppercase()}"
                return fromUrl
            }
        }
        val inline = Regex("/gift/([^/?#\\s]+)", RegexOption.IGNORE_CASE).find(trimmed)
        if (inline != null) {
            val decoded = inline.groupValues[1].trim()
            val ec = ECARD_BODY.find(decoded)
            if (ec != null) return "EC-${ec.groupValues[1].uppercase()}"
            return decoded
        }
        val ec = ECARD_BODY.find(trimmed)
        if (ec != null) return "EC-${ec.groupValues[1].uppercase()}"
        return trimmed
    }

    /** Normalize noisy wedge scans (alias for parse). */
    fun normalizeScannedPayload(raw: String): String = parse(raw)

    /** Compact thermal QR / Code128 payload, e.g. EC9E1E09C. */
    fun qrPayload(code: String): String {
        val parsed = parse(code).ifBlank { code.trim() }
        val m = Regex("""^EC[-' ]?([0-9A-F]{6,12})$""", RegexOption.IGNORE_CASE).find(parsed)
        if (m != null) return "EC${m.groupValues[1].uppercase()}"
        return parsed.replace(Regex("""[\s:_\-]+"""), "").uppercase()
    }
}
