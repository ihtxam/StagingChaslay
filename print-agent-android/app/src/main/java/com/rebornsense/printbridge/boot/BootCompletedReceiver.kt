package com.rebornsense.printbridge.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.rebornsense.printbridge.BridgeSafeStart
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Starts the print bridge foreground service after device reboot or app update
 * so WebPOS can reach localhost:9101 without opening the app manually.
 *
 * WiFi is not required (HTTP binds 127.0.0.1). Credential storage is required —
 * skip until [Intent.ACTION_USER_UNLOCKED] if the first boot broadcast is early.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            ACTION_QUICKBOOT_POWERON,
            Intent.ACTION_USER_UNLOCKED -> scheduleBootStart(context, action)
        }
    }

    private fun scheduleBootStart(context: Context, action: String) {
        val appContext = context.applicationContext
        if (!BridgeUserUnlock.isCredentialStorageReady(appContext)) return
        val pendingResult = goAsync()
        val handler = Handler(Looper.getMainLooper())
        // Encrypted prefs / notification grants may not be ready on BOOT_COMPLETED alone.
        val delayMs = if (action == Intent.ACTION_USER_UNLOCKED) 0L else 4_000L
        handler.postDelayed({
            try {
                startBridgeIfReady(appContext)
                // OEM hubs (Nebullus/Sunmi) sometimes enumerate USB a few seconds after boot.
                handler.postDelayed(
                    {
                        try {
                            startBridgeIfReady(appContext)
                        } finally {
                            pendingResult.finish()
                        }
                    },
                    12_000L,
                )
            } catch (_: Throwable) {
                pendingResult.finish()
            }
        }, delayMs)
    }

    private fun startBridgeIfReady(appContext: Context) {
        if (!BridgeUserUnlock.isCredentialStorageReady(appContext)) return
        runCatching {
            BridgeSafeStart.runWithBootReceiverStart {
                PrintBridgeLauncher.startIfEnabled(appContext)
            }
        }
    }

    companion object {
        /** Some OEMs (HTC, Xiaomi, etc.) use this instead of BOOT_COMPLETED. */
        private const val ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON"
    }
}
