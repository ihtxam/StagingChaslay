package com.rebornsense.printbridge.payment.adyen

import android.app.Application
import android.util.Log
import androidx.startup.AppInitializer
import com.adyen.ipp.api.InPersonPaymentsInitializer

object AdyenApplicationHooks {
    private const val TAG = "AdyenApplicationHooks"
    @Volatile private var initialized = false

    fun onCreate(application: Application) {
        ensureInitialized(application)
    }

    /** Idempotent — safe from Application, MainActivity, and tap-to-pay register before warmUp(). */
    fun ensureInitialized(application: Application) {
        if (initialized) return
        try {
            AppInitializer.getInstance(application)
                .initializeComponent(InPersonPaymentsInitializer::class.java)
            initialized = true
        } catch (t: Throwable) {
            Log.w(TAG, "Adyen Tap to Pay init failed", t)
        }
    }
}
