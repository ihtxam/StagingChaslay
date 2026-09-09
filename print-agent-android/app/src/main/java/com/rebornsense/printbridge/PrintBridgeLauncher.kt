package com.rebornsense.printbridge

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.rebornsense.printbridge.boot.BootStartupActivity
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.service.PrintBridgeService

/**
 * Central entry point for starting the print bridge foreground service from
 * MainActivity, boot receivers, USB attach events, and package updates.
 */
object PrintBridgeLauncher {
    private const val TAG = "PrintBridgeLauncher"
    private val retryHandler = Handler(Looper.getMainLooper())
    private var retryGeneration = 0

    const val ACTION_REFRESH_PRINTERS = "com.rebornsense.printbridge.action.REFRESH_PRINTERS"

    /** Start the service when auto-start is enabled (boot, package update). */
    fun startIfEnabled(context: Context) {
        if (!PrinterPreferences.isAutoStartEnabled(context)) return
        ensureRunning(context)
    }

    /**
     * Start the bridge after boot or when recovering from OEM kills.
     * Launches a headless activity when notification permission is still required.
     */
    fun ensureRunning(context: Context) {
        val appContext = context.applicationContext
        PrinterPreferences.setAutoStartEnabled(appContext, true)
        if (BridgePermissions.hasNotificationPermission(appContext)) {
            start(appContext)
            refreshPrinters(appContext)
            return
        }
        if (shouldLaunchStartupActivity(appContext)) {
            Log.i(TAG, "Launching BootStartupActivity for notification permission + FGS")
            val intent = Intent(appContext, BootStartupActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(BootStartupActivity.EXTRA_FROM_BOOT, true)
            }
            runCatching { appContext.startActivity(intent) }
                .onFailure { error -> Log.w(TAG, "BootStartupActivity launch failed", error) }
        }
    }

    /**
     * Start (or restart) the foreground service.
     * @return true when startForegroundService was invoked; false when notification permission
     *         is missing on Android 13+ (caller should request permission first).
     */
    fun start(context: Context): Boolean {
        val appContext = context.applicationContext
        if (!BridgePermissions.hasNotificationPermission(appContext)) {
            Log.w(TAG, "Skipping FGS start — POST_NOTIFICATIONS not granted")
            ensureRunning(appContext)
            return false
        }
        val intent = Intent(appContext, PrintBridgeService::class.java)
        return runCatching {
            ContextCompat.startForegroundService(appContext, intent)
            scheduleRetries(appContext, intent)
            true
        }.getOrElse { error ->
            Log.w(TAG, "FGS start failed, scheduling retry", error)
            scheduleRetries(appContext, intent)
            false
        }
    }

    /** Ask a running service to re-scan USB, Bluetooth, and LAN printers. */
    fun refreshPrinters(context: Context) {
        val appContext = context.applicationContext
        if (!BridgePermissions.hasNotificationPermission(appContext)) return
        val intent = Intent(appContext, PrintBridgeService::class.java).apply {
            action = ACTION_REFRESH_PRINTERS
        }
        runCatching { ContextCompat.startForegroundService(appContext, intent) }
    }

    private fun scheduleRetries(appContext: Context, intent: Intent) {
        val generation = ++retryGeneration
        RETRY_DELAYS_MS.forEach { delayMs ->
            retryHandler.postDelayed({
                if (generation != retryGeneration) return@postDelayed
                if (!BridgePermissions.hasNotificationPermission(appContext)) {
                    ensureRunning(appContext)
                    return@postDelayed
                }
                if (BridgeHealthChecker.isHealthy()) return@postDelayed
                runCatching { ContextCompat.startForegroundService(appContext, intent) }
                    .onFailure { Log.w(TAG, "FGS retry after ${delayMs}ms failed", it) }
            }, delayMs)
        }
    }

    private fun shouldLaunchStartupActivity(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val last = prefs.getLong(KEY_LAST_STARTUP_ACTIVITY_MS, 0L)
        if (now - last < STARTUP_ACTIVITY_COOLDOWN_MS) return false
        prefs.edit().putLong(KEY_LAST_STARTUP_ACTIVITY_MS, now).apply()
        return true
    }

    private const val PREFS = "print_bridge_launcher"
    private const val KEY_LAST_STARTUP_ACTIVITY_MS = "last_startup_activity_ms"
    private const val STARTUP_ACTIVITY_COOLDOWN_MS = 120_000L

    private val RETRY_DELAYS_MS = longArrayOf(
        1_500L, 3_000L, 6_000L, 10_000L, 20_000L, 45_000L, 90_000L,
    )
}
