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
        receiptBodyTextScale = print.receiptBodyTextScale.coerceIn(1, 3)
    )
}
