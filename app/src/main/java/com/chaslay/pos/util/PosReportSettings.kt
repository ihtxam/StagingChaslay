package com.chaslay.pos.util

import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.PosMode

/** Salon / retail counter: no takeaway vs dine-in on EOD or guest receipts. */
fun BusinessSettingsEntity.reportsShowOrderTypes(): Boolean {
    if (posMode == PosMode.RESTAURANT && tablesEnabled) return true
    if (retailDineInEnabled || retailTakeawayEnabled || retailDeliveryEnabled) return true
    return false
}
