package com.chaslay.pos.sync

import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.remote.dto.SyncCheckoutDto
import com.chaslay.pos.domain.model.PosMode

/** Apply merchant panel posCheckoutSettings onto local business settings. */
fun BusinessSettingsEntity.mergePosCheckoutSettings(checkout: SyncCheckoutDto): BusinessSettingsEntity {
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
    val resolvedMode = when (checkout.posMode) {
        "retail" -> PosMode.RETAIL
        "restaurant" -> PosMode.RESTAURANT
        else -> this.posMode
    }
    val requireTable = checkout.requireTableForDineIn ?: (resolvedMode != PosMode.RETAIL)
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
        vatIncludedInPrice = checkout.vatIncludedInPrice,
        vatAfterDiscount = checkout.vatAfterDiscount,
        posMode = resolvedMode,
        tablesEnabled = checkout.tablesEnabled,
        retailDineInEnabled = checkout.retailDineInEnabled,
        retailTakeawayEnabled = checkout.retailTakeawayEnabled,
        retailDeliveryEnabled = checkout.retailDeliveryEnabled,
        requireTableForDineIn = requireTable
    )
}
