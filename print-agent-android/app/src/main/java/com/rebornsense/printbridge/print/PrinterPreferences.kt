package com.rebornsense.printbridge.print

import android.content.Context

object PrinterPreferences {
    private const val PREFS = "reborn_print_bridge"
    private const val KEY_AUTO_START = "auto_start_enabled"

    /** Whether the print bridge should start automatically on device reboot. Defaults to true. */
    fun isAutoStartEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_AUTO_START, true)
    }

    fun setAutoStartEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AUTO_START, enabled)
            .apply()
    }

    fun getDefaultPrinterId(context: Context): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("default_printer_id", null)
            ?.takeIf { it.isNotBlank() }
    }

    fun setDefaultPrinterId(context: Context, id: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("default_printer_id", id)
            .apply()
    }

    fun getLanHosts(context: Context): List<String> {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet("lan_hosts", emptySet())
            ?.filter { it.isNotBlank() }
            ?.sorted()
            ?: emptyList()
    }

    fun normalizeLanHost(raw: String): String? {
        var value = raw.trim()
        if (value.isBlank()) return null
        value = value.removePrefix("http://").removePrefix("https://").trim()
        value = value.substringBefore('/').trim()
        value = value.substringBefore('?').trim()
        if (value.contains(':')) {
            val hostPart = value.substringBefore(':').trim()
            val portPart = value.substringAfter(':', "").trim()
            if (hostPart.isNotBlank() && (portPart.isEmpty() || portPart == "9100")) {
                value = hostPart
            }
        }
        return value.takeIf { it.isNotBlank() }
    }

    fun addLanHost(context: Context, host: String) {
        val normalized = normalizeLanHost(host) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = prefs.getStringSet("lan_hosts", null)
        val next = HashSet<String>(stored?.size?.coerceAtLeast(1) ?: 1)
        if (stored != null) next.addAll(stored)
        next.add(normalized)
        prefs.edit().putStringSet("lan_hosts", next).apply()
    }

    fun removeLanHost(context: Context, host: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val next = prefs.getStringSet("lan_hosts", emptySet())?.toMutableSet() ?: return
        next.remove(host.trim())
        prefs.edit().putStringSet("lan_hosts", next).apply()
    }

    fun rememberedUsbDevices(context: Context): Set<String> {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_USB_DEVICES, emptySet())
            ?.filter { it.isNotBlank() }
            ?.toSet()
            ?: emptySet()
    }

    fun rememberUsbDevice(context: Context, vidPid: String) {
        val key = vidPid.trim()
        if (key.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val next = prefs.getStringSet(KEY_USB_DEVICES, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (!next.add(key)) return
        prefs.edit().putStringSet(KEY_USB_DEVICES, next).apply()
    }

    fun isRememberedUsbDevice(context: Context, vidPid: String): Boolean {
        return rememberedUsbDevices(context).contains(vidPid.trim())
    }

    private const val KEY_USB_DEVICES = "usb_granted_vid_pid"
}
