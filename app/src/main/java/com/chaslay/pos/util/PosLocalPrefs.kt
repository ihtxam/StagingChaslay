package com.chaslay.pos.util

import android.content.Context

private const val PREFS = "pos_local_prefs"
private const val KEY_VAT_USER_SET = "vat_included_user_set"
private const val KEY_VAT_VALUE = "vat_included_value"
private const val KEY_AUTO_PRINT_USER_SET = "auto_print_receipt_user_set"
private const val KEY_AUTO_PRINT_VALUE = "auto_print_receipt_value"
private const val KEY_TABLES_USER_SET = "tables_enabled_user_set"
private const val KEY_TABLES_VALUE = "tables_enabled_value"
private const val KEY_EOD_INCLUDE_PRODUCTS = "eod_include_products_sold"
private const val KEY_LOCAL_PRODUCT_PRICES = "local_product_prices"
private const val KEY_LOCAL_PRODUCT_PRICES_REMOTE = "local_product_prices_remote"
private const val KEY_LOCAL_VARIANT_PRICES = "local_variant_prices"
private const val KEY_SCALE_USER_SET = "scale_enabled_user_set"
private const val KEY_SCALE_VALUE = "scale_enabled_value"
private const val KEY_SCALE_USB_USER_SET = "scale_usb_user_set"
private const val KEY_SCALE_USB_VALUE = "scale_usb_address_value"

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

    fun saveAutoPrintReceipt(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_AUTO_PRINT_USER_SET, true)
            .putBoolean(KEY_AUTO_PRINT_VALUE, value)
            .apply()
    }

    fun hasUserSetAutoPrintReceipt(context: Context): Boolean =
        prefs(context).getBoolean(KEY_AUTO_PRINT_USER_SET, false)

    fun applyAutoPrintReceiptIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_AUTO_PRINT_USER_SET, false)) return current
        return p.getBoolean(KEY_AUTO_PRINT_VALUE, current)
    }

    fun saveTablesEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_TABLES_USER_SET, true)
            .putBoolean(KEY_TABLES_VALUE, value)
            .apply()
    }

    fun hasUserSetTablesEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_TABLES_USER_SET, false)

    fun applyTablesEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_TABLES_USER_SET, false)) return current
        return p.getBoolean(KEY_TABLES_VALUE, current)
    }

    fun readEodIncludeProductsSold(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EOD_INCLUDE_PRODUCTS, true)

    fun writeEodIncludeProductsSold(context: Context, include: Boolean) {
        prefs(context).edit().putBoolean(KEY_EOD_INCLUDE_PRODUCTS, include).apply()
    }

    /** Locally edited catalog prices — preserved across MERGE menu sync until REPLACE. */
    fun saveLocalProductPrice(
        context: Context,
        productId: Long,
        price: Double,
        remoteId: String? = null
    ) {
        if (productId <= 0L) return
        val map = readLocalProductPrices(context).toMutableMap()
        map[productId] = price
        writeLocalProductPrices(context, map)
        remoteId?.trim()?.takeIf { it.isNotEmpty() }?.let { rid ->
            val remoteMap = readLocalProductPricesRemote(context).toMutableMap()
            remoteMap[rid] = price
            writeLocalProductPricesRemote(context, remoteMap)
        }
    }

    fun getLocalProductPrice(context: Context, productId: Long): Double? =
        readLocalProductPrices(context)[productId]

    fun getLocalProductPriceByRemote(context: Context, remoteId: String): Double? =
        readLocalProductPricesRemote(context)[remoteId.trim()]

    fun clearLocalProductPrice(context: Context, productId: Long) {
        if (productId <= 0L) return
        val map = readLocalProductPrices(context).toMutableMap()
        if (map.remove(productId) != null) {
            writeLocalProductPrices(context, map)
        }
    }

    fun clearAllLocalProductPrices(context: Context) {
        prefs(context).edit()
            .remove(KEY_LOCAL_PRODUCT_PRICES)
            .remove(KEY_LOCAL_PRODUCT_PRICES_REMOTE)
            .remove(KEY_LOCAL_VARIANT_PRICES)
            .apply()
    }

    fun saveLocalVariantPrice(context: Context, productId: Long, variantName: String, price: Double) {
        if (productId <= 0L) return
        val key = variantPriceKey(productId, variantName)
        val map = readLocalVariantPrices(context).toMutableMap()
        map[key] = price
        writeLocalVariantPrices(context, map)
    }

    fun getLocalVariantPrice(context: Context, productId: Long, variantName: String): Double? =
        readLocalVariantPrices(context)[variantPriceKey(productId, variantName)]

    fun saveScaleEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_SCALE_USER_SET, true)
            .putBoolean(KEY_SCALE_VALUE, enabled)
            .apply()
    }

    fun hasUserSetScaleEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_SCALE_USER_SET, false)

    fun applyScaleEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_SCALE_USER_SET, false)) return current
        return p.getBoolean(KEY_SCALE_VALUE, current)
    }

    fun saveScaleUsbAddress(context: Context, address: String?) {
        prefs(context).edit()
            .putBoolean(KEY_SCALE_USB_USER_SET, true)
            .putString(KEY_SCALE_USB_VALUE, address?.trim()?.takeIf { it.isNotEmpty() })
            .apply()
    }

    fun hasUserSetScaleUsbAddress(context: Context): Boolean =
        prefs(context).getBoolean(KEY_SCALE_USB_USER_SET, false)

    fun applyScaleUsbAddressIfUserSet(context: Context, current: String?): String? {
        val p = prefs(context)
        if (!p.getBoolean(KEY_SCALE_USB_USER_SET, false)) return current
        return p.getString(KEY_SCALE_USB_VALUE, current)?.takeIf { it.isNotEmpty() } ?: current
    }

    private fun variantPriceKey(productId: Long, variantName: String): String =
        "$productId|${variantName.trim().lowercase()}"

    private fun readLocalProductPricesRemote(context: Context): Map<String, Double> {
        val raw = prefs(context).getString(KEY_LOCAL_PRODUCT_PRICES_REMOTE, null) ?: return emptyMap()
        return raw.split(';')
            .mapNotNull { entry ->
                val parts = entry.split('=')
                if (parts.size != 2) return@mapNotNull null
                val id = parts[0].trim()
                if (id.isEmpty()) return@mapNotNull null
                val price = parts[1].toDoubleOrNull() ?: return@mapNotNull null
                id to price
            }
            .toMap()
    }

    private fun writeLocalProductPricesRemote(context: Context, map: Map<String, Double>) {
        val serialized = map.entries.joinToString(";") { "${it.key}=${it.value}" }
        prefs(context).edit()
            .putString(KEY_LOCAL_PRODUCT_PRICES_REMOTE, serialized.ifEmpty { null })
            .apply()
    }

    private fun readLocalVariantPrices(context: Context): Map<String, Double> {
        val raw = prefs(context).getString(KEY_LOCAL_VARIANT_PRICES, null) ?: return emptyMap()
        return raw.split(';')
            .mapNotNull { entry ->
                val parts = entry.split('=')
                if (parts.size != 2) return@mapNotNull null
                val key = parts[0].trim()
                if (key.isEmpty()) return@mapNotNull null
                val price = parts[1].toDoubleOrNull() ?: return@mapNotNull null
                key to price
            }
            .toMap()
    }

    private fun writeLocalVariantPrices(context: Context, map: Map<String, Double>) {
        val serialized = map.entries.joinToString(";") { "${it.key}=${it.value}" }
        prefs(context).edit()
            .putString(KEY_LOCAL_VARIANT_PRICES, serialized.ifEmpty { null })
            .apply()
    }

    private fun readLocalProductPrices(context: Context): Map<Long, Double> {
        val raw = prefs(context).getString(KEY_LOCAL_PRODUCT_PRICES, null) ?: return emptyMap()
        return raw.split(';')
            .mapNotNull { entry ->
                val parts = entry.split('=')
                if (parts.size != 2) return@mapNotNull null
                val id = parts[0].toLongOrNull() ?: return@mapNotNull null
                val price = parts[1].toDoubleOrNull() ?: return@mapNotNull null
                id to price
            }
            .toMap()
    }

    private fun writeLocalProductPrices(context: Context, map: Map<Long, Double>) {
        val serialized = map.entries.joinToString(";") { "${it.key}=${it.value}" }
        prefs(context).edit()
            .putString(KEY_LOCAL_PRODUCT_PRICES, serialized.ifEmpty { null })
            .apply()
    }
}
