package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * USB unplug only. Hot-plug permission + discovery use exported [UsbPrinterAttachActivity]
 * (same pattern as Ojavana POS) so the system allow dialog appears without opening Bridge.
 */
class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        runCatching {
            if (!BridgeUserUnlock.isCredentialStorageReady(context)) return
            if (intent?.action != UsbManager.ACTION_USB_DEVICE_DETACHED) return
            val device = intent.usbDeviceExtra()
            if (device != null) {
                UsbAttachPromptGuard.clearSuppressForDevice(context.applicationContext, device)
            }
            Log.d(TAG, "USB detached — refresh printer list")
            PrintBridgeLauncher.refreshPrinters(context)
        }.onFailure { error ->
            Log.w(TAG, "USB detach ignored", error)
        }
    }

    companion object {
        private const val TAG = "UsbAttachReceiver"
    }
}
