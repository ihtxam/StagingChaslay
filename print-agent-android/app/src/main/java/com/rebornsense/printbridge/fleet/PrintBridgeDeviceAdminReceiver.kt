package com.rebornsense.printbridge.fleet

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Device owner component for fleet POS tablets. Provision with:
 * adb shell dpm set-device-owner com.rebornsense.printbridge/.fleet.PrintBridgeDeviceAdminReceiver
 */
class PrintBridgeDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device admin enabled")
        if (KioskController.isDeviceOwner(context)) {
            KioskController.applyDeviceOwnerPolicies(context)
        }
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.w(TAG, "Device admin disabled")
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        Log.i(TAG, "Profile provisioning complete")
        KioskController.applyDeviceOwnerPolicies(context)
    }

    companion object {
        private const val TAG = "PrintBridgeDeviceAdmin"
    }
}
