package com.rebornsense.printbridge.scale

import android.content.Context

/** WebPOS scale USB address — monitored for attach/reboot permission prompts (vid:pid key). */
object ScalePreferences {
    private const val PREFS = "reborn_print_bridge"
    private const val KEY_SCALE_USB = "monitored_scale_usb_address"

    fun getMonitoredScaleAddress(context: Context): String? {
        return runCatching {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_SCALE_USB, null)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        }.getOrNull()
    }

    fun setMonitoredScaleAddress(context: Context, address: String?) {
        val normalized = address?.trim()?.takeIf { it.isNotEmpty() }?.let {
            ScaleUsbHelper.permissionKey(it)
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SCALE_USB, normalized)
            .apply()
    }
}
