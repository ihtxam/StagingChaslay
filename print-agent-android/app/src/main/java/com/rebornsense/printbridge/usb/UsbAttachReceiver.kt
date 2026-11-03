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
 * this receiver posts a notification or launches the allow dialog for **monitored** printers/scales.
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
        val usb = app.getSystemService(UsbManager::class.java) ?: return
        if (usb.hasPermission(device)) {
            PrintBridgeLauncher.refreshAfterHardwareChange(app)
            return
        }
        if (UsbBootAttachGrace.isWithinPostBootGrace(app)) {
            Log.d(TAG, "USB attach — defer permission until after boot grace")
            return
        }
        UsbHostPermissions.syncMonitoredFromPreferences(app)
        val isPrinter = UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(app, device)
        val isScale = UsbHostPermissions.isLikelyScale(app, device)
        if (!isPrinter && !isScale) {
            Log.d(TAG, "USB attach ignored — not a printer or scale candidate")
            return
        }
        val shouldAutoPrinter = isPrinter && UsbHostPermissions.shouldAutoRequestOnAttach(device)
        val shouldAutoScale = isScale && UsbHostPermissions.shouldAutoRequestScaleOnAttach(device)
        if (!shouldAutoPrinter && !shouldAutoScale) {
            Log.d(TAG, "USB attach — skip auto prompt (not default/saved USB device)")
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(app, device)) {
            Log.d(TAG, "USB attach — permission prompt debounced")
            return
        }
        Log.d(TAG, "USB attach — prompt permission for ${device.vendorId}:${device.productId}")
        if (shouldAutoScale && !shouldAutoPrinter) {
            UsbPlugPlay.promptForMissingScale(app, device)
        } else {
            UsbPlugPlay.promptForMissingPrinter(app, device)
        }
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
