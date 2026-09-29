package com.rebornsense.printbridge

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Logs when the bridge service dropped — does not start FGS from Application context (Android 12+ crash).
 */
object BridgeServiceWatchdog {
    private const val TAG = "BridgeServiceWatchdog"
    private val handler = Handler(Looper.getMainLooper())
    private var armed = false

    private val tick = object : Runnable {
        override fun run() {
            if (BridgeSafeStart.mainActivityVisible) {
                Thread {
                    val healthy = runCatching { BridgeHealthChecker.isHealthy() }.getOrElse { false }
                    if (!healthy) {
                        Log.d(TAG, "Bridge HTTP not reachable — tap Start background service in the app")
                    }
                }.start()
            }
            handler.postDelayed(this, INTERVAL_MS)
        }
    }

    private lateinit var appContext: Context

    fun start(context: Context) {
        appContext = context.applicationContext
        if (armed) return
        armed = true
        handler.post(tick)
    }

    fun stop() {
        armed = false
        handler.removeCallbacks(tick)
    }

    private const val INTERVAL_MS = 45_000L
}
