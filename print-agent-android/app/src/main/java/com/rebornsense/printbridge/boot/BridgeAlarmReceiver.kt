package com.rebornsense.printbridge.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.rebornsense.printbridge.BridgeAlarmWatchdog
import com.rebornsense.printbridge.BridgeHealthChecker
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * Survives process death. Wakes periodically to restart the print bridge when OEMs
 * or the user swipe-away kill the foreground service.
 */
class BridgeAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != BridgeAlarmWatchdog.ACTION_CHECK) return
        val appContext = context.applicationContext
        val pendingResult = goAsync()
        Thread {
            try {
                if (!PrinterPreferences.isAutoStartEnabled(appContext)) {
                    BridgeAlarmWatchdog.disarm(appContext)
                    return@Thread
                }
                if (!BridgeHealthChecker.isHealthy()) {
                    PrintBridgeLauncher.ensureRunning(appContext)
                }
            } finally {
                BridgeAlarmWatchdog.arm(appContext)
                pendingResult.finish()
            }
        }.start()
    }
}
