package com.chaslay.pos.sync

import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.dto.SyncPrintDto

/** Apply merchant panel posPrintSettings onto local business settings. */
fun BusinessSettingsEntity.mergePosPrintSettings(print: SyncPrintDto): BusinessSettingsEntity =
    copy(
        adyenReceiptDigitalOnly = print.adyenReceiptDigitalOnly,
        receiptDeliveryDirectionsQr = print.receiptDeliveryDirectionsQr,
        autoPrintKitchen = print.autoPrintKitchen,
        waiterTillBellEnabled = print.waiterTillBellEnabled,
        kitchenPrintRetryEnabled = print.kitchenPrintRetryEnabled,
        kitchenPrintRetryAttempts = print.kitchenPrintRetryAttempts.coerceIn(1, 20),
        kitchenPrintRetryIntervalSec = print.kitchenPrintRetryIntervalSec.coerceIn(2, 60)
    )
