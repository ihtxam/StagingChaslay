package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * USB plug/unplug. The exported [UsbPrinterAttachActivity] handles system attach on some OEMs;
 * this receiver explicitly launches the allow dialog when the service is not running yet.
 */
class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        runCatching {
            if (!BridgeUserUnlock.isCredentialStorageReady(context)) return
            val action = intent?.action ?: return
            val app = context.applicationContext
            when (action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> onUsbAttached(app, intent)
                UsbManager.ACTION_USB_DEVICE_DETACHED -> onUsbDetached(app, intent)
            }
        }.onFailure { error ->
            Log.w(TAG, "USB broadcast ignored", error)
        }
    }

    private fun onUsbAttached(app: Context, intent: Intent) {
        val device = intent.usbDeviceExtra() ?: return
        if (!UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(app, device)) {
            Log.d(TAG, "USB attach ignored — not a printer candidate")
            return
        }
        val usb = app.getSystemService(UsbManager::class.java) ?: return
        if (usb.hasPermission(device)) {
            PrintBridgeLauncher.refreshAfterHardwareChange(app)
            return
        }
        UsbHostPermissions.syncMonitoredFromPreferences(app)
        if (!UsbHostPermissions.shouldAutoRequestPermission(app, device)) {
            Log.d(TAG, "USB attach — skip auto prompt (not default/remembered printer)")
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(app, device)) {
            Log.d(TAG, "USB attach — permission prompt debounced")
            return
        }
        Log.d(TAG, "USB attach — requestPermission for ${device.vendorId}:${device.productId}")
        UsbHostPermissions.requestPermissionFromContext(app, device)
    }

    private fun onUsbDetached(app: Context, intent: Intent) {
        val device = intent.usbDeviceExtra()
        if (device != null) {
            UsbAttachPromptGuard.clearSuppressForDevice(app, device)
        }
        Log.d(TAG, "USB detached — refresh printer list")
        PrintBridgeLauncher.refreshAfterHardwareChange(app)
    }

    companion object {
        private const val TAG = "UsbAttachReceiver"
    }
}
