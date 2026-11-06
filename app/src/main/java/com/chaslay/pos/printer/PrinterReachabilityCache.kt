package com.chaslay.pos.printer

import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Short-lived reachability hints from [BluetoothPrinterService.probePrinterReachable]
 * and recent print attempts. Avoids blocking USB/BT opens when a printer is known offline.
 */
@Singleton
class PrinterReachabilityCache @Inject constructor() {
    private data class Entry(val reachable: Boolean, val updatedAtMs: Long)

    private val entries = ConcurrentHashMap<String, Entry>()

    fun keyForAddress(address: String): String = address.trim().lowercase()

    /** When false, callers should skip connect/print until the entry expires or is cleared. */
    fun shouldAttemptPrint(address: String): Boolean {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        val entry = entries[keyForAddress(trimmed)] ?: return true
        if (System.currentTimeMillis() - entry.updatedAtMs > STALE_MS) return true
        return entry.reachable
    }

    fun markReachable(address: String) {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return
        entries[keyForAddress(trimmed)] = Entry(reachable = true, updatedAtMs = System.currentTimeMillis())
    }

    fun markUnreachable(address: String) {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return
        entries[keyForAddress(trimmed)] = Entry(reachable = false, updatedAtMs = System.currentTimeMillis())
    }

    /** True when a recent probe or print confirmed the printer was reachable. */
    fun isRecentlyReachable(address: String): Boolean {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        val entry = entries[keyForAddress(trimmed)] ?: return false
        if (System.currentTimeMillis() - entry.updatedAtMs > POSITIVE_HOLD_MS) return false
        return entry.reachable
    }

    /**
     * Applies probe result for settings UI and print gating. Transient probe failures do not
     * downgrade a printer that was recently confirmed reachable (Sunmi bind races, USB busy, etc.).
     */
    fun resolveAfterProbe(address: String, probedReachable: Boolean): Boolean {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        if (probedReachable) {
            markReachable(trimmed)
            return true
        }
        if (isRecentlyReachable(trimmed)) return true
        markUnreachable(trimmed)
        return false
    }

    fun clear(address: String) {
        entries.remove(keyForAddress(address.trim()))
    }

    companion object {
        private const val STALE_MS = 45_000L
        /** Keep "connected" in Settings after a successful probe/print despite flaky re-probes. */
        private const val POSITIVE_HOLD_MS = 60_000L
    }
}
