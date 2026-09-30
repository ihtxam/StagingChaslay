package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Log
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * USB plug/unplug without launching a visible activity.
 * Uses [UsbManager.requestPermission] (Ojavana-style "Allow access") instead of the system
 * "Open Bridge Reborn to handle …?" activity chooser.
 */
class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                PrintBridgeLauncher.refreshPrinters(context)
            }
            UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                handleAttach(context.applicationContext, intent)
            }
        }
    }

    private fun handleAttach(app: Context, intent: Intent) {
        val device = intent.usbDeviceExtra() ?: return
        val usb = app.getSystemService(UsbManager::class.java) ?: return
        if (UsbDeviceClassifier.isSunmiInternalUsbShadow(app, device)) {
            Log.d(TAG, "Skip USB attach prompt for Sunmi internal shadow ${device.deviceName}")
            return
        }
        if (!UsbDeviceClassifier.isUsbPrinterCandidate(app, device)) {
            return
        }
        UsbHostPermissions.recordGrantedDevices(app)
        if (usb.hasPermission(device)) {
            PrintBridgeLauncher.refreshPrinters(app)
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(app, device)) {
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            return
        }
        UsbAttachPromptGuard.markPromptIssued(app, device)
        UsbHostPermissions.requestPermissionFromContext(app, device)
    }

    companion object {
        private const val TAG = "UsbAttachReceiver"
    }
}
