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

    fun clear(address: String) {
        entries.remove(keyForAddress(address.trim()))
    }

    companion object {
        private const val STALE_MS = 45_000L
    }
}
