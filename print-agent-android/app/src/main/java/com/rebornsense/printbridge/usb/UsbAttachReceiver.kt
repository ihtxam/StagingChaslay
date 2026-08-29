package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import com.rebornsense.printbridge.PrintBridgeLauncher

class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            UsbManager.ACTION_USB_DEVICE_ATTACHED,
            UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                // USB plug/unplug is an active printer event — keep the bridge running.
                PrintBridgeLauncher.start(context)
                PrintBridgeLauncher.refreshPrinters(context)
            }
        }
    }
}
