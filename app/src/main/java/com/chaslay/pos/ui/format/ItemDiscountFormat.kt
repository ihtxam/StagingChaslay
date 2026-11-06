package com.chaslay.pos.ui.format

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.chaslay.pos.R
import com.chaslay.pos.domain.LineItemDiscount

@Composable
fun lineItemDiscountLabel(
    notes: String?,
    lineDiscountAmount: Double,
    currencySymbol: String,
    formatMoney: (Double, String) -> String,
): String {
    if (lineDiscountAmount <= 0.0) return ""
    val percent = LineItemDiscount.percentFromNotes(notes)
    return if (percent != null) {
        stringResource(
            R.string.discount_percent_applied,
            LineItemDiscount.formatPercentToken(percent),
        )
    } else {
        stringResource(
            R.string.discount_amount_applied,
            "-${formatMoney(lineDiscountAmount, currencySymbol)}",
        )
    }
}
