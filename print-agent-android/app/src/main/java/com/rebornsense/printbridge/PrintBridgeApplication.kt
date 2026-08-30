package com.rebornsense.printbridge

import android.app.Application

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
    }
}
