package com.rebornsense.printbridge

import android.app.Application

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        com.rebornsense.printbridge.setup.OemSetupPreferences.syncInstalledVersion(this)
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
        // Start USB listener registration early; foreground service starts after notification permission.
        com.rebornsense.printbridge.usb.UsbHostPermissions.register(this)
        BridgeServiceWatchdog.start(this)
    }
}
