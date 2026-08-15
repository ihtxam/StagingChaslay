package com.chaslay.pos.sync

import android.content.Context
import android.media.RingtoneManager
import com.chaslay.pos.domain.model.FulfillmentType
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class ImportedOnlineOrderAlert(
    val heldOrderId: String,
    val orderNumber: String,
    val fulfillmentType: FulfillmentType,
    val total: Double,
    val customerName: String? = null,
    val customerPhone: String? = null,
    val pickupTimeMs: Long? = null,
    val itemPreview: List<OnlineOrderAlertItemLine> = emptyList(),
    val itemCount: Int = 0,
    val orderSource: String? = null
)

data class OnlineOrderAlertItemLine(
    val quantity: Int,
    val productName: String
)

@Singleton
class OnlineOrderAlertCoordinator @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _alertQueue = MutableStateFlow<List<ImportedOnlineOrderAlert>>(emptyList())
    val alertQueue: StateFlow<List<ImportedOnlineOrderAlert>> = _alertQueue.asStateFlow()

    private val _unactionedCount = MutableStateFlow(loadUnactionedIds().size)
    val unactionedCount: StateFlow<Int> = _unactionedCount.asStateFlow()

    val currentAlert: ImportedOnlineOrderAlert?
        get() = _alertQueue.value.firstOrNull()

    fun enqueue(orders: List<ImportedOnlineOrderAlert>) {
        if (orders.isEmpty()) return
        val unactioned = loadUnactionedIds().toMutableSet()
        orders.forEach { unactioned.add(it.heldOrderId) }
        saveUnactionedIds(unactioned)
        _unactionedCount.value = unactioned.size

        _alertQueue.update { queue ->
            val seen = queue.map { it.heldOrderId }.toMutableSet()
            val next = queue.toMutableList()
            orders.forEach { order ->
                if (!seen.contains(order.heldOrderId)) {
                    next.add(order)
                    seen.add(order.heldOrderId)
                }
            }
            next
        }
        playAlertChime()
    }

    /** Dismiss popup only — bell badge stays until order is actioned. */
    fun dismissCurrentAlert() {
        _alertQueue.update { queue -> if (queue.isEmpty()) queue else queue.drop(1) }
    }

    fun markActioned(heldOrderId: String) {
        val unactioned = loadUnactionedIds().toMutableSet()
        if (!unactioned.remove(heldOrderId)) return
        saveUnactionedIds(unactioned)
        _unactionedCount.value = unactioned.size
        _alertQueue.update { queue -> queue.filterNot { it.heldOrderId == heldOrderId } }
    }

    fun markCurrentActioned() {
        currentAlert?.heldOrderId?.let { markActioned(it) }
    }

    fun pruneMissingHeldOrderIds(existingHeldOrderIds: Set<String>) {
        val unactioned = loadUnactionedIds().filter { existingHeldOrderIds.contains(it) }.toSet()
        saveUnactionedIds(unactioned)
        _unactionedCount.value = unactioned.size
        _alertQueue.update { queue -> queue.filter { existingHeldOrderIds.contains(it.heldOrderId) } }
    }

    private fun playAlertChime() {
        runCatching {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            RingtoneManager.getRingtone(context, uri)?.play()
        }
    }

    private fun loadUnactionedIds(): Set<String> =
        prefs.getStringSet(KEY_UNACTIONED, emptySet())?.toSet().orEmpty()

    private fun saveUnactionedIds(ids: Set<String>) {
        prefs.edit().putStringSet(KEY_UNACTIONED, ids).apply()
    }

    companion object {
        private const val PREFS_NAME = "online_order_alerts"
        private const val KEY_UNACTIONED = "unactioned_held_ids"
    }
}
