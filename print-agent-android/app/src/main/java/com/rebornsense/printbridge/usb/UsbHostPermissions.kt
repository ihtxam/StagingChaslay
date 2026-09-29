package com.rebornsense.printbridge.usb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * USB host permission for printers only (not barcode/RFID peripherals).
 */
object UsbHostPermissions {
    const val ACTION = "com.rebornsense.printbridge.USB_PERMISSION"

    @Volatile
    private var receiverRegistered = false

    @Volatile
    private var pendingPermissionDeviceId: Int? = null

    private val receiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (context == null || intent?.action != ACTION) return
            pendingPermissionDeviceId = null
            val device = intent.usbDeviceExtra() ?: return
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            if (granted) {
                PrinterPreferences.rememberUsbDevice(context, deviceKey(device))
            }
            val callback = onPermissionSettled
            if (callback != null) {
                android.os.Handler(android.os.Looper.getMainLooper()).post(callback)
            }
        }
    }

    @Volatile
    var onPermissionSettled: (() -> Unit)? = null

    fun register(context: android.content.Context) {
        val app = context.applicationContext
        if (receiverRegistered) return
        val filter = android.content.IntentFilter(ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            app.registerReceiver(receiver, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            app.registerReceiver(receiver, filter)
        }
        receiverRegistered = true
    }

    fun recordGrantedDevices(context: android.content.Context) {
        val app = context.applicationContext
        register(app)
        val usb = usbManager(app) ?: return
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

    fun requestNextMissingPermission(activity: android.app.Activity): Boolean {
        register(activity)
        if (pendingPermissionDeviceId != null) return false
        val usb = usbManager(activity) ?: return false
        val app = activity.applicationContext
        val candidates = usb.deviceList.values
            .filter { UsbDeviceClassifier.isUsbPrinterCandidate(app, it) && !usb.hasPermission(it) }
            .sortedBy { it.deviceId }
        val device = candidates.firstOrNull() ?: return false
        return requestPermissionForDevice(activity, device)
    }

    fun requestPermissionForDevice(activity: android.app.Activity, device: UsbDevice): Boolean {
        register(activity)
        if (pendingPermissionDeviceId != null) return false
        val usb = usbManager(activity) ?: return false
        if (usb.hasPermission(device)) {
            PrinterPreferences.rememberUsbDevice(activity, deviceKey(device))
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
        pendingPermissionDeviceId = device.deviceId
        val flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.PendingIntent.FLAG_MUTABLE
            } else {
                0
            }
        val intent = android.content.Intent(ACTION).setPackage(context.packageName)
        val pi = android.app.PendingIntent.getBroadcast(context, device.deviceId, intent, flags)
        runCatching { usb.requestPermission(device, pi) }
            .onFailure { pendingPermissionDeviceId = null }
    }

    private fun usbManager(context: android.content.Context): UsbManager? =
        context.getSystemService(android.content.Context.USB_SERVICE) as? UsbManager

    private fun deviceKey(device: UsbDevice): String = "${device.vendorId}:${device.productId}"
}
