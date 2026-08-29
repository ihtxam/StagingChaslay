package com.rebornsense.printbridge.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Starts the print bridge foreground service after device reboot or app update
 * so WebPOS can reach localhost:9101 without opening the app manually.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            ACTION_QUICKBOOT_POWERON -> PrintBridgeLauncher.startIfEnabled(context)
        }
    }

    companion object {
        /** Some OEMs (HTC, Xiaomi, etc.) use this instead of BOOT_COMPLETED. */
        private const val ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON"
    }
}
