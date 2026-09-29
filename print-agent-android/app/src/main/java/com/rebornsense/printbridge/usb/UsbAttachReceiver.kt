package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import com.rebornsense.printbridge.PrintBridgeLauncher

/** USB detach only — attach is handled by [UsbPrinterAttachActivity] (system activity launch). */
class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_DETACHED) {
            PrintBridgeLauncher.refreshPrinters(context)
        }
    }
}
