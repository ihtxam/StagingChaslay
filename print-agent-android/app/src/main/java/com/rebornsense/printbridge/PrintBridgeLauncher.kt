package com.rebornsense.printbridge

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.service.PrintBridgeService

/**
 * Central entry point for starting the print bridge foreground service from
 * MainActivity, boot receivers, USB attach events, and package updates.
 */
object PrintBridgeLauncher {
    private const val TAG = "PrintBridgeLauncher"
    private val mainHandler = Handler(Looper.getMainLooper())

    const val ACTION_REFRESH_PRINTERS = "com.rebornsense.printbridge.action.REFRESH_PRINTERS"

    /** Start the service when auto-start is enabled (boot, package update). */
    fun startIfEnabled(context: Context) {
        if (!PrinterPreferences.isAutoStartEnabled(context)) return
        start(context)
    }

    /**
     * Start the foreground service once.
     * A failed start is logged and returned as false. There is no retry loop:
     * repeated startForegroundService calls were crashing and vibrating the tablet.
     * @return true when startForegroundService was invoked; false when notification permission
     *         is missing on Android 13+ (caller should request permission first).
     */
    fun start(context: Context): Boolean {
        val appContext = context.applicationContext
        if (!BridgePermissions.hasNotificationPermission(appContext)) {
            Log.w(TAG, "Skipping FGS start — POST_NOTIFICATIONS not granted")
            BridgeCrashLog.recordReason(
                appContext,
                "startForegroundService",
                "POST_NOTIFICATIONS not granted",
            )
            return false
        }
        if (!BridgeSafeStart.mayStartForegroundService(context)) {
            Log.w(TAG, "Skipping FGS start — no eligible foreground context")
            BridgeCrashLog.recordReason(
                appContext,
                "startForegroundService",
                "no eligible foreground context",
            )
            return false
        }
        if (context !is android.app.Activity && !BridgeSafeStart.canStartBackgroundService(appContext)) {
            Log.w(TAG, "Skipping FGS start — UI not ready for background start")
            return false
        }
        val intent = Intent(appContext, PrintBridgeService::class.java)
        return runCatching {
            ContextCompat.startForegroundService(appContext, intent)
            true
        }.getOrElse { error ->
            BridgeCrashLog.record(appContext, error, "startForegroundService")
            false
        }
    }

    /**
     * Ask the bridge to re-scan printers.
     * Never starts a foreground service from a background [Context] (USB broadcasts crash on Android 12+).
     * Health probe runs off the main thread (USB permission callbacks are on the UI thread).
     */
    fun refreshPrinters(context: Context) {
        val appContext = context.applicationContext
        val hostActivity = context as? android.app.Activity
        val intent = Intent(appContext, PrintBridgeService::class.java).apply {
            action = ACTION_REFRESH_PRINTERS
        }
        Thread {
            val healthy = runCatching { BridgeHealthChecker.isHealthy() }.getOrElse { false }
            if (healthy) {
                runCatching { appContext.startService(intent) }
                    .onFailure { Log.w(TAG, "refresh via startService failed", it) }
                return@Thread
            }
            if (hostActivity == null) {
                Log.d(TAG, "refreshPrinters skipped — service not running and caller is background")
                return@Thread
            }
            if (!BridgePermissions.hasNotificationPermission(appContext)) return@Thread
            mainHandler.post {
                if (hostActivity.isFinishing || hostActivity.isDestroyed) return@post
                if (!BridgeSafeStart.mayStartForegroundService(hostActivity)) return@post
                runCatching { ContextCompat.startForegroundService(appContext, intent) }
                    .onFailure { error ->
                        BridgeCrashLog.record(appContext, error, "refresh FGS start")
                    }
            }
        }.start()
    }
}
