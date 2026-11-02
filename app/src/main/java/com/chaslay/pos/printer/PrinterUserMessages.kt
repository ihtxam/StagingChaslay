package com.chaslay.pos.printer

import android.content.Context
import com.chaslay.pos.R

object PrinterUserMessages {
    fun unavailable(context: Context, printerLabel: String? = null): String =
        if (printerLabel.isNullOrBlank()) {
            context.getString(R.string.printer_unavailable_generic)
        } else {
            context.getString(R.string.printer_unavailable, printerLabel)
        }

    fun fromPrintFailure(context: Context, printerLabel: String? = null): String =
        unavailable(context, printerLabel)
}
