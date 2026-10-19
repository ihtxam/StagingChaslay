package com.rebornsense.printbridge.usb

import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock

/**
 * System USB allow dialogs must run from a visible [android.app.Activity].
 * Background [UsbManager.requestPermission] calls (service / broadcast) often only post a
 * notification on Android 10+ — hot-plug and post-reboot flows launch [UsbPrinterAttachActivity] instead.
 */
object UsbPermissionUi {
    const val ACTION_USB_PERMISSION_PROMPT =
        "com.rebornsense.printbridge.action.USB_PERMISSION_PROMPT"

    private const val TAG = "UsbPermissionUi"

    fun isPermissionPromptAction(action: String?): Boolean {
        return action == ACTION_USB_PERMISSION_PROMPT ||
            action == UsbBootPermissionNotifier.ACTION_REQUEST_USB_PRINTER_PERMISSION
    }

    fun launchPermissionPrompt(context: Context, device: UsbDevice): Boolean {
        if (!BridgeUserUnlock.isCredentialStorageReady(context)) {
            Log.d(TAG, "Skip USB prompt — credential storage locked")
            return false
        }
        val app = context.applicationContext
        val intent = Intent(app, UsbPrinterAttachActivity::class.java).apply {
            action = ACTION_USB_PERMISSION_PROMPT
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_DEVICE_ID, device.deviceId)
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_VID, device.vendorId)
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_PID, device.productId)
            putExtra(UsbManager.EXTRA_DEVICE, device)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_NO_ANIMATION,
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER)
            }
        }
        return runCatching {
            app.startActivity(intent)
            true
        }.onFailure { error ->
            Log.w(TAG, "Could not launch USB permission activity for ${device.deviceId}", error)
        }.getOrDefault(false)
    }
}
