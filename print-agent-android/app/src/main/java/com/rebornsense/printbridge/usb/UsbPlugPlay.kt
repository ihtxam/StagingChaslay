package com.rebornsense.printbridge.usb

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.util.Log
import com.rebornsense.printbridge.print.PrinterEndpoint

/**
 * WebPOS prints from a background service — the system USB allow dialog must be
 * launched from an Activity or a high-priority notification the user taps once.
 */
object UsbPlugPlay {
    private const val TAG = "UsbPlugPlay"

    fun missingPrinterDevices(context: Context): List<UsbDevice> {
        val app = context.applicationContext
        val usb = app.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return emptyList()
        return usb.deviceList.values.filter { device ->
            UsbHostPermissions.needsPermissionRequest(app, usb, device)
        }
    }

    fun pickBestMissingPrinter(context: Context): UsbDevice? {
        return UsbPermissionPicker.pickBest(context, missingPrinterDevices(context))
    }

    /** Launch permission UI or post a tap-to-allow notification. */
    fun promptForMissingPrinter(context: Context, preferred: UsbDevice? = null): Boolean {
        val app = context.applicationContext
        val device = preferred?.takeIf { dev ->
            val usb = app.getSystemService(UsbManager::class.java)
            usb != null && UsbHostPermissions.needsPermissionRequest(app, usb, dev)
        } ?: pickBestMissingPrinter(app)
        if (device == null) {
            Log.d(TAG, "No missing USB printer permission to prompt for")
            return false
        }
        Log.i(TAG, "Prompt USB permission for ${device.vendorId}:${device.productId}")
        if (UsbPermissionUi.launchPermissionPrompt(app, device)) {
            UsbAttachPromptGuard.markPromptIssued(app, device)
            return true
        }
        UsbBootPermissionNotifier.postPermissionNotificationForDevice(app, device)
        return true
    }

    fun endpointNeedsUsbPermission(context: Context, endpoint: PrinterEndpoint): Boolean {
        if (endpoint.connectionType != "usb") return false
        val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return false
        val vid = endpoint.meta["vendorId"]?.toIntOrNull()
        val pid = endpoint.meta["productId"]?.toIntOrNull()
        if (vid == null || pid == null) return false
        val device = usb.deviceList.values.firstOrNull { it.vendorId == vid && it.productId == pid }
            ?: return false
        return !usb.hasPermission(device)
    }
}
