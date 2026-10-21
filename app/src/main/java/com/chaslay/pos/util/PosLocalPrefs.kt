package com.chaslay.pos.util

import android.content.Context

private const val PREFS = "pos_local_prefs"
private const val KEY_VAT_USER_SET = "vat_included_user_set"
private const val KEY_VAT_VALUE = "vat_included_value"
private const val KEY_EOD_INCLUDE_PRODUCTS = "eod_include_products_sold"

object PosLocalPrefs {
    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun saveVatIncludedInPrice(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_VAT_USER_SET, true)
            .putBoolean(KEY_VAT_VALUE, value)
            .apply()
    }

    fun hasUserSetVatIncluded(context: Context): Boolean =
        prefs(context).getBoolean(KEY_VAT_USER_SET, false)

    fun applyVatIncludedIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_VAT_USER_SET, false)) return current
        return p.getBoolean(KEY_VAT_VALUE, current)
    }

    fun readEodIncludeProductsSold(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EOD_INCLUDE_PRODUCTS, true)

    fun writeEodIncludeProductsSold(context: Context, include: Boolean) {
        prefs(context).edit().putBoolean(KEY_EOD_INCLUDE_PRODUCTS, include).apply()
    }
}
