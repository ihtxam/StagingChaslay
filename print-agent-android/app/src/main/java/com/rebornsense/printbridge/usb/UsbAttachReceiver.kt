package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.SystemClock
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * USB plug/unplug without launching a visible activity.
 * Uses [UsbManager.requestPermission] (Ojavana-style "Allow access") instead of the system
 * "Open Bridge Reborn to handle …?" activity chooser.
 *
 * On reboot, USB re-enumerates while WiFi and credential storage are often still down.
 * That must not crash the process or show a permission dialog during early boot.
 */
class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        runCatching {
            if (!BridgeUserUnlock.isCredentialStorageReady(context)) return
            when (intent?.action) {
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    val device = intent.usbDeviceExtra()
                    if (device != null) {
                        UsbAttachPromptGuard.clearSuppressForDevice(context.applicationContext, device)
                    }
                    PrintBridgeLauncher.refreshPrinters(context)
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    handleAttach(context.applicationContext, intent)
                }
            }
        }.onFailure { error ->
            Log.w(TAG, "USB attach/detach ignored", error)
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
        runCatching { UsbHostPermissions.recordGrantedDevices(app) }
        if (usb.hasPermission(device)) {
            PrintBridgeLauncher.refreshPrinters(app)
            return
        }
        // Early boot: USB HAL / notification / WiFi are not ready. A permission Activity
        // from this receiver is what shows "Bridge Reborn has stopped" on cheap tablets.
        if (SystemClock.elapsedRealtime() < EARLY_BOOT_MS) {
            Log.d(TAG, "Skip USB permission dialog during early boot")
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(app, device)) {
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            return
        }
        UsbAttachPromptGuard.markPromptIssued(app, device)
        if (!UsbPermissionUi.launchPermissionPrompt(app, device)) {
            UsbHostPermissions.requestPermissionFromContext(app, device)
        }
    }

    companion object {
        private const val TAG = "UsbAttachReceiver"
        private const val EARLY_BOOT_MS = 25_000L
    }
}
