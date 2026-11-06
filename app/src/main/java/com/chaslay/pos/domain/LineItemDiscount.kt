package com.chaslay.pos.domain

import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import java.util.Locale
import kotlin.math.abs

/** Percent vs fixed-amount line discounts (preset / keypad % vs manual price). */
object LineItemDiscount {
    private val percentOffNote = Regex("""^(\d+(?:\.\d+)?)% off$""", RegexOption.IGNORE_CASE)
    private val priceAdjustNote = Regex("""(?i)^adjusted from """)

    fun percentFromNotes(notes: String?): Double? {
        val trimmed = notes?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        return percentOffNote.matchEntire(trimmed)?.groupValues?.getOrNull(1)?.toDoubleOrNull()
    }

    fun isPercentDiscount(notes: String?): Boolean = percentFromNotes(notes) != null

    fun isFixedAmountDiscount(notes: String?): Boolean =
        priceAdjustNote.containsMatchIn(notes.orEmpty())

    /** Shown in UI strings (e.g. `5` or `12.5`). */
    fun formatPercentToken(percent: Double): String {
        val rounded = (percent * 10.0).toLong() / 10.0
        return if (abs(rounded - rounded.toLong()) < 0.001) {
            rounded.toLong().toString()
        } else {
            String.format(Locale.US, "%.1f", rounded)
        }
    }

    fun CartItem.lineDiscountDisplayPercent(): Double? = percentFromNotes(notes)

    fun TransactionItemEntity.lineDiscountTotal(): Double =
        if (isWeighed) lineDiscountPerUnit * (quantity / 1000.0) else lineDiscountPerUnit * quantity

    fun TransactionItemEntity.lineDiscountDisplayPercent(): Double? = percentFromNotes(notes)
}
