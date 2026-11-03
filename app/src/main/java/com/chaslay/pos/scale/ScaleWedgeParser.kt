package com.chaslay.pos.scale

import kotlin.math.round

/**
 * HID keyboard-wedge scale payloads (digits + Enter, optional prefix/suffix/unit).
 * Ported from dashboard [scale-wedge.ts] for WebPOS parity.
 */
object ScaleWedgeParser {

    data class Result(
        val weightKg: Double,
        val displayUnit: DisplayUnit
    ) {
        enum class DisplayUnit { KG, G }
    }

    fun parse(raw: String, preferredDisplayUnit: Result.DisplayUnit = Result.DisplayUnit.KG): Result? {
        var s = stripControlChars(raw).trim()
        if (s.isEmpty()) return null
        if (looksLikeRetailBarcode(s)) return null

        s = s.replace(Regex("^[\\s*#=+]+"), "")
        s = s.replace(Regex("^(ST|GS|WT|W|S)[\\s,:;-]*", RegexOption.IGNORE_CASE), "")

        var explicitUnit: String? = null
        val unitMatch = Regex("\\s*(kg|g|gr|gram|grams|lb|lbs|oz)\\s*$", RegexOption.IGNORE_CASE)
            .find(s)
        if (unitMatch != null) {
            explicitUnit = unitMatch.groupValues[1]
            s = s.substring(0, unitMatch.range.first).trim()
        }

        if (s.contains(',') && !Regex("^\\d+[.,]\\d+$").matches(s)) {
            val parts = s.split(',').map { it.trim() }.filter { it.isNotEmpty() }
            val lastNumeric = parts.asReversed().firstOrNull { p ->
                Regex("^-?\\d+[.,]?\\d*$").matches(p.replace(",", "."))
            }
            if (lastNumeric != null) s = lastNumeric
        }

        s = s.replace(",", ".").replace(Regex("\\s+"), "")
        if (!Regex("^-?\\d+\\.?\\d*$").matches(s)) return null

        val n = s.toDoubleOrNull() ?: return null
        if (!n.isFinite() || n <= 0.0) return null

        if (explicitUnit != null) {
            val unit = normalizeUnit(explicitUnit) ?: return null
            return Result(
                weightKg = toKg(n, unit),
                displayUnit = if (unit == "g") Result.DisplayUnit.G else Result.DisplayUnit.KG
            )
        }

        if (s.contains('.')) {
            return Result(weightKg = roundWeightKg(n), displayUnit = Result.DisplayUnit.KG)
        }

        if (n >= 100 && n <= 99_999) {
            val asKgFromGrams = roundWeightKg(n / 1000.0)
            if (asKgFromGrams > 0.0 && asKgFromGrams <= 50.0) {
                return Result(weightKg = asKgFromGrams, displayUnit = Result.DisplayUnit.G)
            }
        }

        if (n <= 99.0) {
            return Result(
                weightKg = roundWeightKg(n),
                displayUnit = if (preferredDisplayUnit == Result.DisplayUnit.G) {
                    Result.DisplayUnit.G
                } else {
                    Result.DisplayUnit.KG
                }
            )
        }

        return Result(weightKg = roundWeightKg(n / 1000.0), displayUnit = Result.DisplayUnit.G)
    }

    private fun stripControlChars(raw: String): String =
        raw.replace(Regex("[\\x00-\\x1F\\x7F]"), "")

    private fun looksLikeRetailBarcode(code: String): Boolean {
        if (code.isEmpty() || Regex("\\s").containsMatchIn(code)) return false
        val digits = code.replace(Regex("\\D"), "")
        if (digits.length >= 8 && digits.length == code.replace(Regex("[-\\s]"), "").length) return true
        if (Regex("^[A-Za-z0-9][A-Za-z0-9._-]{7,}$").matches(code)) return true
        return false
    }

    private fun normalizeUnit(raw: String): String? {
        val u = raw.lowercase()
        return when {
            u == "kg" || u == "k" -> "kg"
            u == "g" || u.startsWith("gr") -> "g"
            u.startsWith("lb") -> "lb"
            u.startsWith("oz") -> "oz"
            else -> null
        }
    }

    private fun toKg(value: Double, unit: String): Double = when (unit) {
        "g" -> roundWeightKg(value / 1000.0)
        "lb" -> roundWeightKg(value * 0.45359237)
        "oz" -> roundWeightKg(value * 0.0283495231)
        else -> roundWeightKg(value)
    }

    private fun roundWeightKg(kg: Double): Double =
        round(kg * 1000.0) / 1000.0

    fun formatBuffer(weightKg: Double, unit: Result.DisplayUnit): String {
        if (!weightKg.isFinite() || weightKg <= 0.0) return ""
        return when (unit) {
            Result.DisplayUnit.G -> kotlin.math.round(weightKg * 1000.0).toInt().toString()
            Result.DisplayUnit.KG -> {
                val rounded = round(weightKg * 1000.0) / 1000.0
                String.format(java.util.Locale.US, "%.3f", rounded).trimEnd('0').trimEnd('.')
                    .ifEmpty { "0" }
            }
        }
    }
}
