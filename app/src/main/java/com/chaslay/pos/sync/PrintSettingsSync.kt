package com.chaslay.pos.sync

import android.content.Context
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.dto.SyncPrintDto
import com.chaslay.pos.util.PosLocalPrefs

/**
 * Apply merchant panel posPrintSettings onto local business settings.
 * Saved hardware (Room `printer_configs`, Bridge `lan_hosts`) is device-local and never replaced by cloud sync.
 */
fun BusinessSettingsEntity.mergePosPrintSettings(
    print: SyncPrintDto,
    context: Context? = null
): BusinessSettingsEntity {
    val resolvedAutoPrintReceipt = if (context != null && PosLocalPrefs.hasUserSetAutoPrintReceipt(context)) {
        this.autoPrintReceipt
    } else {
        print.autoPrintReceipt
    }
    val resolvedAutoPrintKitchen = if (context != null && PosLocalPrefs.hasUserSetAutoPrintKitchen(context)) {
        this.autoPrintKitchen
    } else {
        print.autoPrintKitchen
    }
    val template = print.receiptTemplateName.trim().ifBlank { "Default" }
    return copy(
        adyenReceiptDigitalOnly = print.adyenReceiptDigitalOnly,
        receiptDeliveryDirectionsQr = print.receiptDeliveryDirectionsQr,
        autoPrintKitchen = resolvedAutoPrintKitchen,
        autoPrintReceipt = resolvedAutoPrintReceipt,
        waiterTillBellEnabled = print.waiterTillBellEnabled,
        kitchenPrintRetryEnabled = print.kitchenPrintRetryEnabled,
        kitchenPrintRetryAttempts = print.kitchenPrintRetryAttempts.coerceIn(1, 20),
        kitchenPrintRetryIntervalSec = print.kitchenPrintRetryIntervalSec.coerceIn(2, 60),
        receiptTemplateName = template,
        receiptHeader = print.receiptHeader,
        receiptFooter = print.receiptFooter.ifBlank { receiptFooter },
        receiptShowVatTable = print.receiptShowVatTable,
        receiptShowStaffLine = print.receiptShowStaffLine,
        receiptShowQrCode = print.receiptShowQrCode,
        receiptShowGoogleReviewQr = print.receiptShowGoogleReviewQr,
        receiptGoogleReviewsUrl = print.receiptGoogleReviewsUrl?.trim()?.take(500)?.ifBlank { null },
        receiptBodyTextScale = print.receiptBodyTextScale.coerceIn(1, 3)
    )
}

/** http(s) Google review link from merchant print settings, or null. */
fun BusinessSettingsEntity.normalizedGoogleReviewUrl(): String? {
    val raw = receiptGoogleReviewsUrl?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val withScheme = when {
        raw.startsWith("https://", ignoreCase = true) || raw.startsWith("http://", ignoreCase = true) -> raw
        raw.contains("://") -> return null
        else -> "https://$raw"
    }
    if (withScheme.any { it.isWhitespace() }) return null
    return withScheme.take(500)
}
