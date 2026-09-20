package com.rebornsense.printbridge

import android.content.Context
import com.rebornsense.printbridge.print.PrinterEndpoint

/** Merchant-friendly labels — hide raw ids and duplicate LAN host:port strings. */
object PrinterDisplay {
    fun title(endpoint: PrinterEndpoint): String {
        return when (endpoint.connectionType) {
            "lan" -> "Network printer"
            "sunmi-internal" -> "Built-in printer"
            "bluetooth" -> endpoint.name
                .substringBefore(" (")
                .trim()
                .ifBlank { "Bluetooth printer" }
            "usb" -> endpoint.name.trim().ifBlank { "USB printer" }
            else -> endpoint.name.trim().ifBlank { "Printer" }
        }
    }

    fun subtitle(context: Context, endpoint: PrinterEndpoint): String? {
        return when (endpoint.connectionType) {
            "lan" -> {
                val host = endpoint.meta["host"]?.trim().orEmpty()
                if (host.isBlank()) null else context.getString(R.string.printer_network_subtitle, host)
            }
            "bluetooth" -> endpoint.meta["address"]?.trim()?.takeIf { it.isNotBlank() }
            "usb" -> null
            "sunmi-internal" -> context.getString(R.string.printer_type_builtin)
            else -> null
        }
    }

    fun typeLabel(context: Context, endpoint: PrinterEndpoint): String {
        return when (endpoint.connectionType) {
            "lan" -> context.getString(R.string.printer_type_network)
            "bluetooth" -> context.getString(R.string.printer_type_bluetooth)
            "usb" -> context.getString(R.string.printer_type_usb)
            "sunmi-internal" -> context.getString(R.string.printer_type_builtin)
            else -> endpoint.connectionType.replaceFirstChar { it.uppercase() }
        }
    }
}
