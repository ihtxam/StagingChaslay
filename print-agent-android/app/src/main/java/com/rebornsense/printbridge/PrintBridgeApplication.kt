package com.rebornsense.printbridge

import android.app.Application

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
        // Start the foreground service after install/update so WebPOS can reach localhost:9101
        // without opening MainActivity first.
        PrintBridgeLauncher.start(this)
    }
}
