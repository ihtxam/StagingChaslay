package com.rebornsense.printbridge

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.service.PrintBridgeService

/**
 * Central entry point for starting the print bridge foreground service from
 * MainActivity, boot receivers, USB attach events, and package updates.
 */
object PrintBridgeLauncher {
    const val ACTION_REFRESH_PRINTERS = "com.rebornsense.printbridge.action.REFRESH_PRINTERS"

    /** Start the service when auto-start is enabled (boot, package update). */
    fun startIfEnabled(context: Context) {
        if (!PrinterPreferences.isAutoStartEnabled(context)) return
        start(context)
    }

    /** Start (or restart) the foreground service and refresh printer connections. */
    fun start(context: Context) {
        val appContext = context.applicationContext
        val intent = Intent(appContext, PrintBridgeService::class.java)
        runCatching {
            ContextCompat.startForegroundService(appContext, intent)
        }.onFailure {
            // Retry once — some OEMs reject FGS until notification permission is granted.
            Handler(Looper.getMainLooper()).postDelayed({
                runCatching { ContextCompat.startForegroundService(appContext, intent) }
            }, 1500L)
        }
    }

    /** Ask a running service to re-scan USB, Bluetooth, and LAN printers. */
    fun refreshPrinters(context: Context) {
        val appContext = context.applicationContext
        val intent = Intent(appContext, PrintBridgeService::class.java).apply {
            action = ACTION_REFRESH_PRINTERS
        }
        ContextCompat.startForegroundService(appContext, intent)
    }
}
