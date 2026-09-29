package com.rebornsense.printbridge

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Nebullus / multi-peripheral tablets crash if FGS + printer scan run in the same
 * frame as the notification permission dialog closing. Debounce and gate starts.
 */
object BridgeSafeStart {
    private const val TAG = "BridgeSafeStart"
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastStartAttemptMs = 0L
    private var pendingStart: Runnable? = null

    @Volatile
    var allowWatchdogAndBackgroundStart: Boolean = false

    /** One-shot for [BootCompletedReceiver] only — not for watchdog or Application context. */
    @Volatile
    private var allowBootReceiverStart: Boolean = false

    @Volatile
    var mainActivityVisible: Boolean = false

    fun markUiReady() {
        allowWatchdogAndBackgroundStart = true
    }

    fun canStartBackgroundService(context: android.content.Context): Boolean {
        if (!allowWatchdogAndBackgroundStart) return false
        if (!BridgePermissions.hasNotificationPermission(context)) return false
        return true
    }

    fun mayStartForegroundService(context: android.content.Context): Boolean {
        if (context is Activity) return true
        if (allowBootReceiverStart) return true
        if (mainActivityVisible && canStartBackgroundService(context)) return true
        return false
    }

    fun runWithBootReceiverStart(block: () -> Unit) {
        allowBootReceiverStart = true
        try {
            block()
        } finally {
            allowBootReceiverStart = false
        }
    }

    /** Call from MainActivity after POST_NOTIFICATIONS is granted. */
    fun scheduleStartFromActivity(activity: Activity, delayMs: Long = 900L) {
        pendingStart?.let { mainHandler.removeCallbacks(it) }
        val runnable = Runnable {
            pendingStart = null
            if (activity.isFinishing || activity.isDestroyed) return@Runnable
            startNow(activity)
        }
        pendingStart = runnable
        mainHandler.postDelayed(runnable, delayMs)
    }

    fun startNow(context: android.content.Context, bypassDebounce: Boolean = false): Boolean {
        if (!BridgePermissions.hasNotificationPermission(context)) return false
        val now = System.currentTimeMillis()
        if (!bypassDebounce && now - lastStartAttemptMs < 1_500L) return false
        lastStartAttemptMs = now
        return runCatching {
            PrintBridgeLauncher.start(context)
        }.getOrElse { error ->
            Log.w(TAG, "Bridge start failed", error)
            false
        }
    }

    fun cancelPending() {
        pendingStart?.let { mainHandler.removeCallbacks(it) }
        pendingStart = null
    }
}
