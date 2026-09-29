package com.rebornsense.printbridge

import android.app.Application

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        BridgeCrashLog.install(this)
        com.rebornsense.printbridge.setup.OemSetupPreferences.syncInstalledVersion(this)
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
        // Boot starts the service when auto-start is on. USB scans stay off this thread.
    }
}
