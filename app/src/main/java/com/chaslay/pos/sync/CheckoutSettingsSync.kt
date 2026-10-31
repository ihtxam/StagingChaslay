package com.chaslay.pos.sync

import android.content.Context
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.dto.SyncCheckoutDto
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.util.PosLocalPrefs

/** Apply merchant panel posCheckoutSettings onto local business settings. */
fun BusinessSettingsEntity.mergePosCheckoutSettings(
    checkout: SyncCheckoutDto,
    context: Context? = null
): BusinessSettingsEntity {
    val tipCsv = checkout.tipPresetsPercent
        .filter { it >= 0 }
        .take(8)
        .joinToString(",") { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() }
        .ifBlank { "0,5,10,15" }
    val densCsv = checkout.quickCashDenominations
        .filter { it > 0 }
        .take(12)
        .joinToString(",") { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() }
        .ifBlank { "10,20,50,100" }
    val step = checkout.roundingStep
    val roundingStep = if (step in listOf(0.0, 0.05, 0.1, 0.5, 1.0)) step else this.roundingStep
    val syncedMode = PosMode.fromCheckoutValue(checkout.posMode) ?: this.posMode
    val requireTable = checkout.requireTableForDineIn ?: (syncedMode != PosMode.RETAIL)
    val vatIncluded = if (context != null && PosLocalPrefs.hasUserSetVatIncluded(context)) {
        vatIncludedInPrice
    } else {
        checkout.vatIncludedInPrice
    }
    val tables = when {
        context != null && PosLocalPrefs.hasUserSetTablesEnabled(context) ->
            PosLocalPrefs.applyTablesEnabledIfUserSet(context, tablesEnabled)
        syncedMode == PosMode.RETAIL -> false
        else -> checkout.tablesEnabled
    }
    return copy(
        tipsEnabled = checkout.tipsEnabled,
        allowCustomTip = checkout.allowCustomTip,
        tipPresetsPercentCsv = tipCsv,
        discountsEnabled = checkout.discountsEnabled,
        roundingStep = roundingStep,
        quickCashEnabled = checkout.quickCashEnabled,
        quickCashDenominationsCsv = densCsv,
        splitBillsEnabled = checkout.splitBillsEnabled,
        maxSplitParts = checkout.maxSplitParts.coerceIn(2, 20),
        vatIncludedInPrice = vatIncluded,
        vatAfterDiscount = checkout.vatAfterDiscount,
        posMode = syncedMode,
        tablesEnabled = tables,
        retailDineInEnabled = checkout.retailDineInEnabled,
        retailTakeawayEnabled = checkout.retailTakeawayEnabled,
        retailDeliveryEnabled = checkout.retailDeliveryEnabled,
        requireTableForDineIn = requireTable,
        courseSendMode = if (checkout.courseSendMode == "send_all_once") {
            "send_all_once"
        } else {
            "fire_per_course"
        },
        // Single panel toggle for Cash/Card/Terminal buttons under products.
        expressEnabled = checkout.expressCheckoutEnabled
    )
}

/** True when local values sent to POST /v1/sync/terminals would differ. */
fun BusinessSettingsEntity.terminalSyncPayloadChanged(other: BusinessSettingsEntity): Boolean {
    return adyenTerminalId.trim() != other.adyenTerminalId.trim() ||
        adyenTerminalEnabled != other.adyenTerminalEnabled ||
        adyenApiKey.trim() != other.adyenApiKey.trim() ||
        adyenMerchantAccount.trim() != other.adyenMerchantAccount.trim() ||
        adyenClientId.trim() != other.adyenClientId.trim()
}
