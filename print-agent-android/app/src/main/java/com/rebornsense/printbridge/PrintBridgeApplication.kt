package com.rebornsense.printbridge

import android.app.Application
import android.os.Handler
import android.os.Looper
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.usb.UsbHostPermissions

class PrintBridgeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        runCatching { BridgeCrashLog.install(this) }
        // Reboot often has no WiFi yet. Never throw out of Application.onCreate —
        // that is the system "has stopped" dialog. Skip CE work until unlock.
        if (!BridgeUserUnlock.isCredentialStorageReady(this)) return
        runCatching { UsbHostPermissions.recordGrantedDevices(this) }
        runCatching { com.rebornsense.printbridge.setup.OemSetupPreferences.syncInstalledVersion(this) }
        runCatching {
            val hooks = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenApplicationHooks")
            hooks.getMethod("onCreate", Application::class.java).invoke(null, this)
        }
        if (PrinterPreferences.isAutoStartEnabled(this)) {
            val handler = Handler(Looper.getMainLooper())
            BridgeSafeStart.runWithBootReceiverStart {
                handler.postDelayed({ PrintBridgeLauncher.startIfEnabled(this) }, 5_000L)
                handler.postDelayed({ PrintBridgeLauncher.startIfEnabled(this) }, 18_000L)
            }
        }
    }
}
