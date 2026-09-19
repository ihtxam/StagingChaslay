package com.rebornsense.printbridge.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * USB host permission for printers/scales.
 *
 * Android drops UsbManager grants on reboot unless the app is the default handler
 * for USB_DEVICE_ATTACHED (device-filter). FLAG_IMMUTABLE also prevents UsbManager
 * from attaching EXTRA_DEVICE / EXTRA_PERMISSION_GRANTED, so the grant never sticks.
 */
object UsbHostPermissions {
    const val ACTION = "com.rebornsense.printbridge.USB_PERMISSION"

    @Volatile
    private var receiverRegistered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (context == null || intent?.action != ACTION) return
            val device = intent.usbDeviceExtra() ?: return
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            if (granted) {
                PrinterPreferences.rememberUsbDevice(context, deviceKey(device))
            }
        }
    }

    fun register(context: Context) {
        val app = context.applicationContext
        if (receiverRegistered) return
        val filter = IntentFilter(ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            app.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            app.registerReceiver(receiver, filter)
        }
        receiverRegistered = true
    }

    /**
     * Request access only for printer/scale-like devices that are not already granted.
     * Matching USB_DEVICE_ATTACHED filters + a prior "always" choice make hasPermission
     * true after reboot, so this is a no-op and no dialog is shown.
     */
    fun ensureGranted(context: Context) {
        val app = context.applicationContext
        register(app)
        val usb = usbManager(app) ?: return
        for (device in usb.deviceList.values) {
            if (!isPrintOrScaleDevice(device)) continue
            if (usb.hasPermission(device)) {
                PrinterPreferences.rememberUsbDevice(app, deviceKey(device))
                continue
            }
            requestPermission(app, usb, device)
        }
    }

    fun hasPermission(context: Context, device: UsbDevice): Boolean {
        return usbManager(context)?.hasPermission(device) == true
    }

    private fun requestPermission(context: Context, usb: UsbManager, device: UsbDevice) {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE
            } else {
                0
            }
        val intent = Intent(ACTION).setPackage(context.packageName)
        val pi = PendingIntent.getBroadcast(context, device.deviceId, intent, flags)
        usb.requestPermission(device, pi)
    }

    fun isPrintOrScaleDevice(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        if (device.vendorId in KNOWN_LABEL_VENDOR_IDS) return true
        return (0 until device.interfaceCount).any { index ->
            val intf = device.getInterface(index)
            if (intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER) return true
            if (intf.interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC && hasBulkOut(intf)) return true
            if (intf.interfaceClass == UsbConstants.USB_CLASS_CDC_DATA && hasBulkOut(intf)) return true
            if (intf.interfaceClass == UsbConstants.USB_CLASS_COMM && hasBulkOut(intf)) return true
            hasBulkOut(intf) && intf.interfaceClass !in NON_PRINTER_CLASSES
        }
    }

    private fun hasBulkOut(intf: android.hardware.usb.UsbInterface): Boolean {
        for (e in 0 until intf.endpointCount) {
            val ep = intf.getEndpoint(e)
            if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.direction == UsbConstants.USB_DIR_OUT) {
                return true
            }
        }
        return false
    }

    private fun usbManager(context: Context): UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

    private fun deviceKey(device: UsbDevice): String = "${device.vendorId}:${device.productId}"

    private fun Intent.usbDeviceExtra(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }

    private val KNOWN_LABEL_VENDOR_IDS = setOf(
        0x0355, // Wuhan Jingchen / Niimbot
        0x0483, // STM32
        0x1A86, // QinHeng CH340
        0x067B, // Prolific
        0x0416, // Winbond
        0x0FE6, // ICS Advent
    )

    private val NON_PRINTER_CLASSES = setOf(
        UsbConstants.USB_CLASS_HID,
        UsbConstants.USB_CLASS_HUB,
        UsbConstants.USB_CLASS_MASS_STORAGE,
        UsbConstants.USB_CLASS_AUDIO,
        UsbConstants.USB_CLASS_VIDEO,
        UsbConstants.USB_CLASS_WIRELESS_CONTROLLER,
    )
}
