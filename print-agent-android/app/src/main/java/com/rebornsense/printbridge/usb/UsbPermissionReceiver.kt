package com.rebornsense.printbridge.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Delivers [UsbManager.requestPermission] results (manifest receiver — works when app is backgrounded). */
class UsbPermissionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != UsbHostPermissions.ACTION) return
        UsbHostPermissions.deliverPermissionResult(context, intent)
    }
}
