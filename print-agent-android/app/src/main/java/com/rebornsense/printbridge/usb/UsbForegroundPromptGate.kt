package com.rebornsense.printbridge.usb

import android.os.SystemClock

/**
 * Prevents Bridge from hijacking the tablet by repeatedly launching MainActivity
 * for USB permission from background timers / WebPOS polling / onResume loops.
 */
object UsbForegroundPromptGate {
    private const val MIN_BACKGROUND_LAUNCH_MS = 300_000L // 5 minutes between unprompted launches

    @Volatile
    private var lastBackgroundLaunchElapsed: Long = 0L

    /** User tapped a button in Bridge or WebPOS — always allow one foreground prompt. */
    fun launchMainActivity(userInitiated: Boolean): Boolean {
        if (userInitiated) return true
        val now = SystemClock.elapsedRealtime()
        val last = lastBackgroundLaunchElapsed
        if (last > 0L && now - last < MIN_BACKGROUND_LAUNCH_MS) {
            return false
        }
        lastBackgroundLaunchElapsed = now
        return true
    }
}
