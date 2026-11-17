package com.chaslay.pos.util

import android.content.Context

private const val PREFS = "pos_local_prefs"
private const val KEY_VAT_USER_SET = "vat_included_user_set"
private const val KEY_VAT_VALUE = "vat_included_value"
private const val KEY_AUTO_PRINT_USER_SET = "auto_print_receipt_user_set"
private const val KEY_AUTO_PRINT_VALUE = "auto_print_receipt_value"
private const val KEY_AUTO_PRINT_KITCHEN_USER_SET = "auto_print_kitchen_user_set"
private const val KEY_AUTO_PRINT_KITCHEN_VALUE = "auto_print_kitchen_value"
private const val KEY_TABLES_USER_SET = "tables_enabled_user_set"
private const val KEY_TABLES_VALUE = "tables_enabled_value"
private const val KEY_EOD_INCLUDE_PRODUCTS = "eod_include_products_sold"
private const val KEY_EOD_INCLUDE_STAFF = "eod_include_staff_breakdown"
private const val KEY_LOCAL_PRODUCT_PRICES = "local_product_prices"
private const val KEY_LOCAL_PRODUCT_PRICES_REMOTE = "local_product_prices_remote"
private const val KEY_LOCAL_VARIANT_PRICES = "local_variant_prices"
private const val KEY_SCALE_USER_SET = "scale_enabled_user_set"
private const val KEY_SCALE_VALUE = "scale_enabled_value"
private const val KEY_SCALE_USB_USER_SET = "scale_usb_user_set"
private const val KEY_SCALE_USB_VALUE = "scale_usb_address_value"
private const val KEY_RETAIL_DINE_IN_USER_SET = "retail_dine_in_user_set"
private const val KEY_RETAIL_DINE_IN_VALUE = "retail_dine_in_value"
private const val KEY_RETAIL_TAKEAWAY_USER_SET = "retail_takeaway_user_set"
private const val KEY_RETAIL_TAKEAWAY_VALUE = "retail_takeaway_value"
private const val KEY_RETAIL_DELIVERY_USER_SET = "retail_delivery_user_set"
private const val KEY_RETAIL_DELIVERY_VALUE = "retail_delivery_value"
private const val KEY_EXPRESS_PLACEMENT_USER_SET = "express_pay_placement_user_set"
private const val KEY_EXPRESS_PLACEMENT_VALUE = "express_pay_placement_value"
private const val KEY_EXPRESS_ENABLED_USER_SET = "express_checkout_enabled_user_set"
private const val KEY_EXPRESS_ENABLED_VALUE = "express_checkout_enabled_value"
private const val KEY_RETAIL_CASH_DIALOG_USER_SET = "retail_cash_tender_dialog_user_set"
private const val KEY_RETAIL_CASH_DIALOG_VALUE = "retail_cash_tender_dialog_value"
private const val KEY_RETAIL_WEIGHED_ENTRY_USER_SET = "retail_weighed_custom_entry_user_set"
private const val KEY_RETAIL_WEIGHED_ENTRY_VALUE = "retail_weighed_custom_entry_value"
private const val KEY_RESTAURANT_WEIGHED_ENTRY_USER_SET = "restaurant_weighed_custom_entry_user_set"
private const val KEY_RESTAURANT_WEIGHED_ENTRY_VALUE = "restaurant_weighed_custom_entry_value"
private const val KEY_COURSE_SEND_MODE_USER_SET = "course_send_mode_user_set"
private const val KEY_COURSE_SEND_MODE_VALUE = "course_send_mode_value"
private const val KEY_AFTER_SALE_GO_TO_ORDERS = "after_sale_go_to_orders"
private const val KEY_POS_MENU_DESIGN = "pos_menu_design"

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

    fun saveAutoPrintKitchen(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_AUTO_PRINT_KITCHEN_USER_SET, true)
            .putBoolean(KEY_AUTO_PRINT_KITCHEN_VALUE, value)
            .apply()
    }

    fun hasUserSetAutoPrintKitchen(context: Context): Boolean =
        prefs(context).getBoolean(KEY_AUTO_PRINT_KITCHEN_USER_SET, false)

    fun applyAutoPrintKitchenIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_AUTO_PRINT_KITCHEN_USER_SET, false)) return current
        return p.getBoolean(KEY_AUTO_PRINT_KITCHEN_VALUE, current)
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

    fun saveRetailDineInEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RETAIL_DINE_IN_USER_SET, true)
            .putBoolean(KEY_RETAIL_DINE_IN_VALUE, value)
            .apply()
    }

    fun hasUserSetRetailDineInEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RETAIL_DINE_IN_USER_SET, false)

    fun applyRetailDineInEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RETAIL_DINE_IN_USER_SET, false)) return current
        return p.getBoolean(KEY_RETAIL_DINE_IN_VALUE, current)
    }

    fun saveRetailTakeawayEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RETAIL_TAKEAWAY_USER_SET, true)
            .putBoolean(KEY_RETAIL_TAKEAWAY_VALUE, value)
            .apply()
    }

    fun hasUserSetRetailTakeawayEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RETAIL_TAKEAWAY_USER_SET, false)

    fun applyRetailTakeawayEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RETAIL_TAKEAWAY_USER_SET, false)) return current
        return p.getBoolean(KEY_RETAIL_TAKEAWAY_VALUE, current)
    }

    fun saveRetailDeliveryEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RETAIL_DELIVERY_USER_SET, true)
            .putBoolean(KEY_RETAIL_DELIVERY_VALUE, value)
            .apply()
    }

    fun hasUserSetRetailDeliveryEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RETAIL_DELIVERY_USER_SET, false)

    fun applyRetailDeliveryEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RETAIL_DELIVERY_USER_SET, false)) return current
        return p.getBoolean(KEY_RETAIL_DELIVERY_VALUE, current)
    }

    fun saveExpressPayPlacement(context: Context, placement: String) {
        prefs(context).edit()
            .putBoolean(KEY_EXPRESS_PLACEMENT_USER_SET, true)
            .putString(KEY_EXPRESS_PLACEMENT_VALUE, placement)
            .apply()
    }

    fun hasUserSetExpressPayPlacement(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EXPRESS_PLACEMENT_USER_SET, false)

    fun applyExpressPayPlacementIfUserSet(context: Context, current: String): String {
        val p = prefs(context)
        if (!p.getBoolean(KEY_EXPRESS_PLACEMENT_USER_SET, false)) return current
        return p.getString(KEY_EXPRESS_PLACEMENT_VALUE, current) ?: current
    }

    fun saveExpressCheckoutEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_EXPRESS_ENABLED_USER_SET, true)
            .putBoolean(KEY_EXPRESS_ENABLED_VALUE, value)
            .apply()
    }

    fun hasUserSetExpressCheckoutEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EXPRESS_ENABLED_USER_SET, false)

    fun applyExpressCheckoutEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_EXPRESS_ENABLED_USER_SET, false)) return current
        return p.getBoolean(KEY_EXPRESS_ENABLED_VALUE, current)
    }

    fun saveRetailCashTenderDialogEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RETAIL_CASH_DIALOG_USER_SET, true)
            .putBoolean(KEY_RETAIL_CASH_DIALOG_VALUE, value)
            .apply()
    }

    fun hasUserSetRetailCashTenderDialogEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RETAIL_CASH_DIALOG_USER_SET, false)

    fun applyRetailCashTenderDialogEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RETAIL_CASH_DIALOG_USER_SET, false)) return current
        return p.getBoolean(KEY_RETAIL_CASH_DIALOG_VALUE, current)
    }

    fun saveRetailWeighedCustomEntryEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RETAIL_WEIGHED_ENTRY_USER_SET, true)
            .putBoolean(KEY_RETAIL_WEIGHED_ENTRY_VALUE, value)
            .apply()
    }

    fun hasUserSetRetailWeighedCustomEntryEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RETAIL_WEIGHED_ENTRY_USER_SET, false)

    fun applyRetailWeighedCustomEntryEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RETAIL_WEIGHED_ENTRY_USER_SET, false)) return current
        return p.getBoolean(KEY_RETAIL_WEIGHED_ENTRY_VALUE, current)
    }

    fun saveRestaurantWeighedCustomEntryEnabled(context: Context, value: Boolean) {
        prefs(context).edit()
            .putBoolean(KEY_RESTAURANT_WEIGHED_ENTRY_USER_SET, true)
            .putBoolean(KEY_RESTAURANT_WEIGHED_ENTRY_VALUE, value)
            .apply()
    }

    fun hasUserSetRestaurantWeighedCustomEntryEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RESTAURANT_WEIGHED_ENTRY_USER_SET, false)

    fun applyRestaurantWeighedCustomEntryEnabledIfUserSet(context: Context, current: Boolean): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(KEY_RESTAURANT_WEIGHED_ENTRY_USER_SET, false)) return current
        return p.getBoolean(KEY_RESTAURANT_WEIGHED_ENTRY_VALUE, current)
    }

    fun saveCourseSendMode(context: Context, mode: String) {
        prefs(context).edit()
            .putBoolean(KEY_COURSE_SEND_MODE_USER_SET, true)
            .putString(KEY_COURSE_SEND_MODE_VALUE, mode)
            .apply()
    }

    fun hasUserSetCourseSendMode(context: Context): Boolean =
        prefs(context).getBoolean(KEY_COURSE_SEND_MODE_USER_SET, false)

    fun applyCourseSendModeIfUserSet(context: Context, current: String): String {
        val p = prefs(context)
        if (!p.getBoolean(KEY_COURSE_SEND_MODE_USER_SET, false)) return current
        return p.getString(KEY_COURSE_SEND_MODE_VALUE, current) ?: current
    }

    fun readEodIncludeProductsSold(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EOD_INCLUDE_PRODUCTS, true)

    fun writeEodIncludeProductsSold(context: Context, include: Boolean) {
        prefs(context).edit().putBoolean(KEY_EOD_INCLUDE_PRODUCTS, include).apply()
    }

    fun readEodIncludeStaffBreakdown(context: Context): Boolean =
        prefs(context).getBoolean(KEY_EOD_INCLUDE_STAFF, false)

    fun writeEodIncludeStaffBreakdown(context: Context, include: Boolean) {
        prefs(context).edit().putBoolean(KEY_EOD_INCLUDE_STAFF, include).apply()
    }

    /** When true, POS opens the Orders tab after the order-complete dialog is dismissed. */
    fun readAfterSaleGoToOrders(context: Context): Boolean =
        prefs(context).getBoolean(KEY_AFTER_SALE_GO_TO_ORDERS, false)

    fun writeAfterSaleGoToOrders(context: Context, goToOrders: Boolean) {
        prefs(context).edit().putBoolean(KEY_AFTER_SALE_GO_TO_ORDERS, goToOrders).apply()
    }

    fun savePosMenuDesign(context: Context, design: String) {
        prefs(context).edit().putString(KEY_POS_MENU_DESIGN, design).apply()
    }

    fun readPosMenuDesign(context: Context): String =
        prefs(context).getString(KEY_POS_MENU_DESIGN, com.chaslay.pos.domain.model.PosMenuDesign.CLASSIC.name)
            ?: com.chaslay.pos.domain.model.PosMenuDesign.CLASSIC.name

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
