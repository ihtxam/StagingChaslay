package com.rebornsense.printbridge

import android.content.Context
import android.os.Handler
import android.os.Looper

/**
 * Keeps the foreground bridge service alive when OEMs kill it after boot or memory pressure.
 */
object BridgeServiceWatchdog {
    private val handler = Handler(Looper.getMainLooper())
    private var armed = false

    private val tick = object : Runnable {
        override fun run() {
            if (!BridgeHealthChecker.isHealthy()) {
                PrintBridgeLauncher.start(appContext)
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
