package com.chaslay.pos.sync

import android.content.Context
import android.media.RingtoneManager
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.FloorDeviceRole
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WaiterTillBellNotifier @Inject constructor(
    @ApplicationContext private val context: Context,
    private val orderAlertNotifier: OrderAlertNotifier
) {
    private var lastBellAtMs = 0L

    fun ringIfEnabled(settings: BusinessSettingsEntity, tableName: String? = null) {
        if (!settings.waiterTillBellEnabled) return
        if (FloorDeviceRole.fromApi(settings.floorDeviceRole) != FloorDeviceRole.MAIN_POS) return
        val now = System.currentTimeMillis()
        if (now - lastBellAtMs < DEDUPE_MS) return
        lastBellAtMs = now
        runCatching {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            RingtoneManager.getRingtone(context, uri)?.play()
        }
        val label = tableName?.trim()?.takeIf { it.isNotBlank() }
        val body = if (label != null) {
            context.getString(R.string.waiter_till_bell_named, label)
        } else {
            context.getString(R.string.waiter_till_bell)
        }
        orderAlertNotifier.notifyWaiterOrderAtTill(body)
    }

    companion object {
        private const val DEDUPE_MS = 15_000L
    }
}
