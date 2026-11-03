package com.chaslay.pos.printer

import android.content.Context
import android.os.SystemClock

/**
 * After reboot, OEM USB stacks often emit duplicate [android.hardware.usb.UsbManager.ACTION_USB_DEVICE_ATTACHED]
 * broadcasts when the app starts. Defer **attach-receiver** permission prompts until this grace window passes.
 *
 * Android often drops USB host permission across reboot (OEM-dependent). The saved printer stays plugged in
 * without a new ATTACHED broadcast, so [UsbPrinterManager.syncForegroundUsbPermissionState] performs one
 * foreground prompt per boot when a monitored printer or scale is connected but not authorized.
 */
object UsbBootAttachGrace {
    private const val PREFS = "usb_boot_attach_grace"
    private const val KEY_BOOT_ELAPSED = "boot_elapsed_realtime"
    private const val KEY_FOREGROUND_PROMPT_BOOT = "foreground_prompt_boot_elapsed"
    private const val KEY_FOREGROUND_SCALE_PROMPT_BOOT = "foreground_scale_prompt_boot_elapsed"
    /** Long enough for delayed USB enumeration on Sunmi / Nebullus hubs. */
    const val GRACE_MS = 120_000L

    /** Fallback when the app is opened before [BootCompletedReceiver] runs. */
    fun ensureBootAnchorIfUnset(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.contains(KEY_BOOT_ELAPSED)) return
        if (SystemClock.elapsedRealtime() < 90_000L) {
            markBootCompleted(context)
        }
    }

    fun markBootCompleted(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_BOOT_ELAPSED, SystemClock.elapsedRealtime())
            .apply()
    }

    fun isWithinPostBootGrace(context: Context): Boolean {
        val bootElapsed = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_BOOT_ELAPSED, -1L)
        if (bootElapsed < 0L) return false
        return SystemClock.elapsedRealtime() - bootElapsed < GRACE_MS
    }

    /** True once per reboot until [markPostBootForegroundPromptCompleted] runs for this boot anchor. */
    fun shouldOfferPostBootForegroundPrompt(context: Context): Boolean {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val bootElapsed = prefs.getLong(KEY_BOOT_ELAPSED, -1L)
        if (bootElapsed < 0L) return false
        return prefs.getLong(KEY_FOREGROUND_PROMPT_BOOT, -1L) != bootElapsed
    }

    /** Call after handling (or skipping) the single post-reboot foreground USB check — not on every onResume. */
    fun markPostBootForegroundPromptCompleted(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val bootElapsed = prefs.getLong(KEY_BOOT_ELAPSED, -1L)
        if (bootElapsed < 0L) return
        prefs.edit().putLong(KEY_FOREGROUND_PROMPT_BOOT, bootElapsed).apply()
    }

    /** Once per reboot for saved USB scale (independent of printer post-boot prompt). */
    fun shouldOfferPostBootScaleForegroundPrompt(context: Context): Boolean {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val bootElapsed = prefs.getLong(KEY_BOOT_ELAPSED, -1L)
        if (bootElapsed < 0L) return false
        return prefs.getLong(KEY_FOREGROUND_SCALE_PROMPT_BOOT, -1L) != bootElapsed
    }

    fun markPostBootScaleForegroundPromptCompleted(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val bootElapsed = prefs.getLong(KEY_BOOT_ELAPSED, -1L)
        if (bootElapsed < 0L) return
        prefs.edit().putLong(KEY_FOREGROUND_SCALE_PROMPT_BOOT, bootElapsed).apply()
    }
}
