package com.chaslay.pos.sync

import android.content.Context
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.dto.SyncCheckoutDto
import com.chaslay.pos.domain.model.ExpressPayPlacement
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
    val retailDineIn = if (context != null && PosLocalPrefs.hasUserSetRetailDineInEnabled(context)) {
        PosLocalPrefs.applyRetailDineInEnabledIfUserSet(context, retailDineInEnabled)
    } else {
        checkout.retailDineInEnabled
    }
    val retailTakeaway = if (context != null && PosLocalPrefs.hasUserSetRetailTakeawayEnabled(context)) {
        PosLocalPrefs.applyRetailTakeawayEnabledIfUserSet(context, retailTakeawayEnabled)
    } else {
        checkout.retailTakeawayEnabled
    }
    val retailDelivery = if (context != null && PosLocalPrefs.hasUserSetRetailDeliveryEnabled(context)) {
        PosLocalPrefs.applyRetailDeliveryEnabledIfUserSet(context, retailDeliveryEnabled)
    } else {
        checkout.retailDeliveryEnabled
    }
    val expressPlacement = if (context != null && PosLocalPrefs.hasUserSetExpressPayPlacement(context)) {
        PosLocalPrefs.applyExpressPayPlacementIfUserSet(context, expressPayPlacement)
    } else {
        ExpressPayPlacement.toCheckoutValue(
            ExpressPayPlacement.fromCheckoutValue(checkout.expressPayPlacement)
        )
    }
    val expressCheckout = if (context != null && PosLocalPrefs.hasUserSetExpressCheckoutEnabled(context)) {
        PosLocalPrefs.applyExpressCheckoutEnabledIfUserSet(context, expressEnabled)
    } else {
        checkout.expressCheckoutEnabled
    }
    val retailCashDialog = if (context != null && PosLocalPrefs.hasUserSetRetailCashTenderDialogEnabled(context)) {
        PosLocalPrefs.applyRetailCashTenderDialogEnabledIfUserSet(context, retailCashTenderDialogEnabled)
    } else {
        checkout.retailCashTenderDialogEnabled
    }
    val syncedCourseSendMode = if (checkout.courseSendMode == "send_all_once") {
        "send_all_once"
    } else {
        "fire_per_course"
    }
    val courseSend = if (context != null && PosLocalPrefs.hasUserSetCourseSendMode(context)) {
        PosLocalPrefs.applyCourseSendModeIfUserSet(context, courseSendMode)
    } else {
        syncedCourseSendMode
    }
    return copy(
        tipsEnabled = checkout.tipsEnabled,
        terminalAskGratuityEnabled = checkout.terminalAskGratuityEnabled,
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
        retailDineInEnabled = retailDineIn,
        retailTakeawayEnabled = retailTakeaway,
        retailDeliveryEnabled = retailDelivery,
        requireTableForDineIn = requireTable,
        courseSendMode = courseSend,
        // Single panel toggle for Cash/Card/Terminal buttons under products.
        expressEnabled = expressCheckout,
        expressPayPlacement = expressPlacement,
        retailCashTenderDialogEnabled = retailCashDialog
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
