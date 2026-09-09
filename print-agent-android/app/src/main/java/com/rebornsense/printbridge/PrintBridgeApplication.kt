package com.rebornsense.printbridge

import android.app.Application
import com.rebornsense.printbridge.BridgeAlarmWatchdog

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        com.rebornsense.printbridge.setup.OemSetupPreferences.syncInstalledVersion(this)
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
        // Always-on: start bridge after reboot/update (uses BootStartupActivity when needed).
        PrintBridgeLauncher.ensureRunning(this)
        BridgeServiceWatchdog.start(this)
        BridgeAlarmWatchdog.arm(this)
    }
}
