package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.PrintBridgeLauncher

class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                val device = intent.usbDeviceExtra() ?: return
                if (!UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(context.applicationContext, device)) {
                    return
                }
                val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return
                UsbHostPermissions.recordGrantedDevices(context)
                if (usb.hasPermission(device)) {
                    PrintBridgeLauncher.refreshPrinters(context)
                    return
                }
                // System USB grant dialog must run from a visible Activity (not from a BroadcastReceiver).
                val open = Intent(context, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                    )
                    putExtra(MainActivity.EXTRA_USB_DEVICE_ID, device.deviceId)
                }
                context.startActivity(open)
            }
            UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                runCatching { PrintBridgeLauncher.refreshPrinters(context) }
            }
        }
    }

    private fun Intent.usbDeviceExtra(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }
}
