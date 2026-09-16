package com.rebornsense.printbridge.fleet

import android.content.Context

object FleetPreferences {
    private const val PREFS = "print_bridge_fleet"
    private const val KEY_KIOSK_ENABLED = "kiosk_enabled"
    private const val KEY_ADMIN_PIN = "admin_pin"
    private const val KEY_POS_URL = "pos_url"
    private const val KEY_BROWSER_PACKAGE = "browser_package"

    fun isKioskEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_KIOSK_ENABLED, false)
    }

    fun setKioskEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_KIOSK_ENABLED, enabled)
            .apply()
    }

    fun getAdminPin(context: Context): String {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ADMIN_PIN, DEFAULT_ADMIN_PIN)
            ?.trim()
            .orEmpty()
            .ifBlank { DEFAULT_ADMIN_PIN }
    }

    fun setAdminPin(context: Context, pin: String) {
        val normalized = pin.trim().ifBlank { DEFAULT_ADMIN_PIN }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ADMIN_PIN, normalized)
            .apply()
    }

    fun verifyAdminPin(context: Context, pin: String): Boolean {
        return getAdminPin(context) == pin.trim()
    }

    fun getPosUrlOverride(context: Context): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_POS_URL, null)
            ?.trim()
            ?.takeIf { it.startsWith("http") }
    }

    fun setPosUrlOverride(context: Context, url: String?) {
        val trimmed = url?.trim()?.takeIf { it.startsWith("http") }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_POS_URL, trimmed)
            .apply()
    }

    fun getBrowserPackage(context: Context): String? {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BROWSER_PACKAGE, null)
            ?.trim()
            ?.takeIf { it.isNotBlank() }
    }

    fun setBrowserPackage(context: Context, packageName: String?) {
        val trimmed = packageName?.trim()?.takeIf { it.isNotBlank() }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BROWSER_PACKAGE, trimmed)
            .apply()
    }

    private const val DEFAULT_ADMIN_PIN = "0000"
}
