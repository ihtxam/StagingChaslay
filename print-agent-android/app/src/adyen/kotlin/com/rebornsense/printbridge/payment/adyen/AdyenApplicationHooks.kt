package com.rebornsense.printbridge.payment.adyen

import android.app.Application
import android.util.Log
import androidx.startup.AppInitializer
import com.adyen.ipp.api.InPersonPaymentsInitializer

object AdyenApplicationHooks {
    private const val TAG = "AdyenApplicationHooks"

    fun onCreate(application: Application) {
        try {
            AppInitializer.getInstance(application)
                .initializeComponent(InPersonPaymentsInitializer::class.java)
        } catch (t: Throwable) {
            Log.w(TAG, "Adyen Tap to Pay init failed", t)
        }
    }
}
