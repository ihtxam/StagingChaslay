package com.rebornsense.printbridge.usb

import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * USB host permission for printers only (not barcode/RFID peripherals).
 */
object UsbHostPermissions {
    private const val TAG = "UsbHostPermissions"
    const val ACTION = "com.rebornsense.printbridge.USB_PERMISSION"

    @Volatile
    private var pendingPermissionDeviceId: Int? = null

    @Volatile
    var onPermissionSettled: (() -> Unit)? = null

    /** True when Bridge should show the system USB allow dialog for this device. */
    fun needsPermissionRequest(
        context: android.content.Context,
        usb: UsbManager,
        device: UsbDevice,
    ): Boolean {
        if (usb.hasPermission(device)) return false
        return UsbDeviceClassifier.isUsbPrinterCandidate(context.applicationContext, device)
    }

    fun register(context: android.content.Context) {
        // Permission results are handled by [UsbPermissionReceiver] in the manifest.
        context.applicationContext
    }

    fun deliverPermissionResult(context: android.content.Context, intent: android.content.Intent) {
        pendingPermissionDeviceId = null
        val device = intent.usbDeviceExtra() ?: return
        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        val app = context.applicationContext
        if (granted) {
            PrinterPreferences.rememberUsbDevice(app, deviceKey(device))
            Log.i(TAG, "USB permission granted for ${deviceKey(device)} deviceId=${device.deviceId}")
        } else {
            Log.i(TAG, "USB permission denied for ${deviceKey(device)} deviceId=${device.deviceId}")
        }
        notifyPermissionSettled()
    }

    fun recordGrantedDevices(context: android.content.Context) {
        val app = context.applicationContext
        val usb = usbManager(app) ?: return
        reconcilePendingWithGrant(usb, app)
        for (device in usb.deviceList.values) {
            if (!UsbDeviceClassifier.isUsbPrinterCandidate(app, device)) continue
            if (usb.hasPermission(device)) {
                PrinterPreferences.rememberUsbDevice(app, deviceKey(device))
            }
        }
    }

    fun ensureGranted(context: android.content.Context) {
        recordGrantedDevices(context)
        if (context is android.app.Activity) {
            requestNextMissingPermission(context)
        }
    }

    fun requestNextMissingPermission(
        activity: android.app.Activity,
        preferredVidPid: String? = null,
    ): Boolean {
        register(activity)
        val usb = usbManager(activity) ?: return false
        val app = activity.applicationContext
        reconcilePendingWithGrant(usb, app)
        if (pendingPermissionDeviceId != null) return false
        val preferred = preferredVidPid?.trim()?.takeIf { it.isNotEmpty() }
        val candidates = usb.deviceList.values
            .filter { needsPermissionRequest(app, usb, it) }
            .sortedWith(
                compareBy<UsbDevice> { device ->
                    preferred != null && deviceKey(device) != preferred
                }.thenBy { !UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(app, it) }
                    .thenBy { it.deviceId },
            )
        val device = candidates.firstOrNull() ?: return false
        return requestPermissionForDevice(activity, device)
    }

    fun requestPermissionForDevice(activity: android.app.Activity, device: UsbDevice): Boolean {
        register(activity)
        val usb = usbManager(activity) ?: return false
        val app = activity.applicationContext
        reconcilePendingWithGrant(usb, app)
        if (pendingPermissionDeviceId != null) return false
        if (!needsPermissionRequest(app, usb, device)) {
            if (usb.hasPermission(device)) {
                PrinterPreferences.rememberUsbDevice(app, deviceKey(device))
                Log.d(TAG, "Skip USB request — already granted for ${deviceKey(device)}")
            }
            return false
        }
        requestPermission(activity, usb, device)
        return true
    }

    fun hasPermission(context: android.content.Context, device: UsbDevice): Boolean {
        return usbManager(context)?.hasPermission(device) == true
    }

    fun isRequestPending(): Boolean = pendingPermissionDeviceId != null

    private fun requestPermission(context: android.content.Context, usb: UsbManager, device: UsbDevice) {
        if (usb.hasPermission(device)) {
            Log.d(TAG, "Skip USB requestPermission — hasPermission already true for ${deviceKey(device)}")
            PrinterPreferences.rememberUsbDevice(context.applicationContext, deviceKey(device))
            return
        }
        pendingPermissionDeviceId = device.deviceId
        val flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.PendingIntent.FLAG_MUTABLE
            } else {
                0
            }
        val intent = android.content.Intent(ACTION)
            .setClass(context.applicationContext, UsbPermissionReceiver::class.java)
        val pi = android.app.PendingIntent.getBroadcast(context.applicationContext, device.deviceId, intent, flags)
        Log.i(TAG, "Requesting USB permission for ${deviceKey(device)} deviceId=${device.deviceId}")
        runCatching { usb.requestPermission(device, pi) }
            .onFailure { error ->
                pendingPermissionDeviceId = null
                Log.w(TAG, "usb.requestPermission failed for ${deviceKey(device)}", error)
            }
    }

    /** Grant arrived but our PendingIntent broadcast was dropped — clear stale pending state. */
    private fun reconcilePendingWithGrant(usb: UsbManager, app: android.content.Context) {
        val pendingId = pendingPermissionDeviceId ?: return
        val device = usb.deviceList.values.firstOrNull { it.deviceId == pendingId }
        if (device == null) {
            pendingPermissionDeviceId = null
            return
        }
        if (usb.hasPermission(device)) {
            pendingPermissionDeviceId = null
            PrinterPreferences.rememberUsbDevice(app, deviceKey(device))
            Log.d(TAG, "Reconciled pending USB grant for ${deviceKey(device)}")
        }
    }

    private fun notifyPermissionSettled() {
        val callback = onPermissionSettled
        if (callback != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post(callback)
        }
    }

    private fun usbManager(context: android.content.Context): UsbManager? =
        context.getSystemService(android.content.Context.USB_SERVICE) as? UsbManager

    private fun deviceKey(device: UsbDevice): String = "${device.vendorId}:${device.productId}"
}
