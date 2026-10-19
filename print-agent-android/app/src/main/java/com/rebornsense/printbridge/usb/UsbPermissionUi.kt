package com.rebornsense.printbridge.usb

import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.MainActivity

/**
 * System USB allow dialogs must run from a visible [MainActivity].
 * Transparent [UsbPrinterAttachActivity] is not enough on Android 15 / Nebullus — the dialog
 * only appears when Bridge's main window is in the foreground (Ojavana behaviour).
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
        return launchMainActivityForUsbPermission(context, device, minimizeAfter = true)
    }

    fun launchMainActivityForUsbPermission(
        context: Context,
        device: UsbDevice,
        minimizeAfter: Boolean = true,
    ): Boolean {
        if (!BridgeUserUnlock.isCredentialStorageReady(context)) {
            Log.d(TAG, "Skip USB prompt — credential storage locked")
            return false
        }
        val app = context.applicationContext
        val intent = Intent(app, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            putExtra(MainActivity.EXTRA_REQUEST_USB_PERMISSION, true)
            putExtra(MainActivity.EXTRA_USB_PERMISSION_THEN_MINIMIZE, minimizeAfter)
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_DEVICE_ID, device.deviceId)
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_VID, device.vendorId)
            putExtra(UsbBootPermissionNotifier.EXTRA_USB_PID, device.productId)
            putExtra(UsbManager.EXTRA_DEVICE, device)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER)
            }
        }
        return runCatching {
            app.startActivity(intent)
            true
        }.onFailure { error ->
            Log.w(TAG, "Could not launch MainActivity for USB permission ${device.deviceId}", error)
        }.getOrDefault(false)
    }
}
