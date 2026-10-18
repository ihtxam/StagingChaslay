package com.rebornsense.printbridge.usb

import android.content.Context
import android.hardware.usb.UsbDevice
import android.os.SystemClock

/**
 * Stops the USB allow dialog from flashing on reboot when several attach events or
 * discovery passes hit the same printer within seconds.
 */
object UsbAttachPromptGuard {
    private const val PREFS = "usb_attach_prompt_guard"
    private const val KEY_LAST_PROMPT_ELAPSED = "last_prompt_elapsed"
    private const val KEY_LAST_DEVICE_KEY = "last_device_key"
    private const val KEY_SUPPRESS_UNTIL_ELAPSED = "suppress_until_elapsed"
    /** Debounce duplicate ATTACHED broadcasts for the same printer, not replug after unplug. */
    private const val PROMPT_COOLDOWN_MS = 8_000L

    fun shouldSuppressPermissionDialog(context: Context, device: UsbDevice): Boolean {
        if (UsbDeviceClassifier.isSunmiInternalUsbShadow(context.applicationContext, device)) {
            return true
        }
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val until = prefs.getLong(KEY_SUPPRESS_UNTIL_ELAPSED, 0L)
        val now = SystemClock.elapsedRealtime()
        if (until > now) {
            val key = prefs.getString(KEY_LAST_DEVICE_KEY, null)
            if (key == deviceKey(device)) return true
        }
        return false
    }

    fun markPromptIssued(context: Context, device: UsbDevice) {
        val now = SystemClock.elapsedRealtime()
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_PROMPT_ELAPSED, now)
            .putLong(KEY_SUPPRESS_UNTIL_ELAPSED, now + PROMPT_COOLDOWN_MS)
            .putString(KEY_LAST_DEVICE_KEY, deviceKey(device))
            .apply()
    }

    /** After unplug, the next plug must show the system allow dialog again (new USB session). */
    fun clearSuppressForDevice(context: Context, device: UsbDevice) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = deviceKey(device)
        if (prefs.getString(KEY_LAST_DEVICE_KEY, null) != key) return
        prefs.edit()
            .remove(KEY_SUPPRESS_UNTIL_ELAPSED)
            .remove(KEY_LAST_DEVICE_KEY)
            .apply()
    }

    private fun deviceKey(device: UsbDevice): String = "${device.vendorId}:${device.productId}"
}
