package com.chaslay.pos.sync

import android.content.Context
import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.remote.dto.FloorAckRequest
import com.chaslay.pos.data.remote.FloorApi
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.KitchenPrintMeta
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class PendingKitchenPrintJob(
    val id: String,
    val tableName: String,
    val serviceType: String,
    val round: Int,
    val itemsJson: String,
    val metaJson: String,
    val cloudPrintJobId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val attempts: Int = 0,
    val lastError: String? = null,
    val exhausted: Boolean = false
)

@Singleton
class KitchenPrintRetryQueue @Inject constructor(
    @ApplicationContext context: Context,
    private val printerService: BluetoothPrinterService,
    private val floorApi: FloorApi,
    private val waiterTillBellNotifier: WaiterTillBellNotifier
) {
    private val gson = Gson()
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private var jobs: MutableList<PendingKitchenPrintJob> = load()

    fun pendingCount(): Int = jobs.count { !it.exhausted }

    fun exhaustedJobs(): List<PendingKitchenPrintJob> = jobs.filter { it.exhausted }

    fun enqueue(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        meta: KitchenPrintMeta,
        cloudPrintJobId: String? = null
    ) {
        if (!settings.kitchenPrintRetryEnabled) return
        val job = PendingKitchenPrintJob(
            id = "kp-${System.currentTimeMillis()}-${items.size}",
            tableName = tableName,
            serviceType = serviceType.name,
            round = round,
            itemsJson = gson.toJson(items),
            metaJson = gson.toJson(meta),
            cloudPrintJobId = cloudPrintJobId
        )
        jobs.add(0, job)
        trimAndPersist()
    }

    suspend fun processNext(settings: BusinessSettingsEntity, fromRemoteDevice: Boolean = false): Boolean {
        if (!settings.kitchenPrintRetryEnabled) return false
        val job = jobs.firstOrNull { !it.exhausted } ?: return false
        val maxAttempts = settings.kitchenPrintRetryAttempts.coerceIn(1, 20)
        val itemsType = object : TypeToken<List<TableOrderItemEntity>>() {}.type
        val items: List<TableOrderItemEntity> = gson.fromJson(job.itemsJson, itemsType) ?: return false
        val metaType = object : TypeToken<KitchenPrintMeta>() {}.type
        val meta: KitchenPrintMeta = gson.fromJson(job.metaJson, metaType) ?: KitchenPrintMeta()
        val serviceType = runCatching { ServiceType.valueOf(job.serviceType) }
            .getOrDefault(ServiceType.DINE_IN)

        val success = withContext(Dispatchers.IO) {
            printerService.routeKitchen(
                settings = settings,
                tableName = job.tableName,
                serviceType = serviceType,
                round = job.round,
                items = items,
                isFollowUp = false,
                message = null,
                categories = emptyList(),
                products = emptyList(),
                meta = meta
            ).isSuccess
        }

        if (success) {
            job.cloudPrintJobId?.let { cloudId ->
                runCatching {
                    floorApi.ackPrintJob(cloudId, FloorAckRequest(status = "DONE"))
                }
            }
            if (fromRemoteDevice || job.cloudPrintJobId != null) {
                waiterTillBellNotifier.ringIfEnabled(settings, job.tableName)
            }
            jobs.removeAll { it.id == job.id }
            persist()
            return true
        }

        val nextAttempts = job.attempts + 1
        val exhausted = nextAttempts >= maxAttempts
        val updated = job.copy(
            attempts = nextAttempts,
            lastError = "Print failed",
            exhausted = exhausted
        )
        jobs = jobs.map { if (it.id == job.id) updated else it }.toMutableList()
        if (exhausted) {
            job.cloudPrintJobId?.let { cloudId ->
                runCatching {
                    floorApi.ackPrintJob(cloudId, FloorAckRequest(status = "FAILED"))
                }
            }
            Log.w(TAG, "Kitchen print job exhausted after $nextAttempts attempts: ${job.tableName}")
        }
        persist()
        return false
    }

    fun dismiss(jobId: String) {
        jobs.removeAll { it.id == jobId }
        persist()
    }

    fun clearExhausted() {
        jobs.removeAll { it.exhausted }
        persist()
    }

    private fun trimAndPersist() {
        if (jobs.size > MAX_JOBS) {
            jobs = jobs.take(MAX_JOBS).toMutableList()
        }
        persist()
    }

    private fun load(): MutableList<PendingKitchenPrintJob> {
        val raw = prefs.getString(KEY, null) ?: return mutableListOf()
        return runCatching {
            val type = object : TypeToken<List<PendingKitchenPrintJob>>() {}.type
            (gson.fromJson<List<PendingKitchenPrintJob>>(raw, type) ?: emptyList()).toMutableList()
        }.getOrDefault(mutableListOf())
    }

    private fun persist() {
        prefs.edit().putString(KEY, gson.toJson(jobs)).apply()
    }

    companion object {
        private const val TAG = "KitchenPrintRetry"
        private const val PREFS = "chaslay_kitchen_print_retry_v1"
        private const val KEY = "jobs"
        private const val MAX_JOBS = 40
    }
}
