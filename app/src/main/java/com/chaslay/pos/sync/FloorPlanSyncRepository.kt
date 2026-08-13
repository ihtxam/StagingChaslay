package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.repository.TableOrderRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FloorPlanSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val syncPreferences: SyncPreferences,
    private val tableOrderRepository: TableOrderRepository
) {
    suspend fun syncFloorPlans(): FloorPlanSyncResult {
        if (!syncApiKeyStore.hasKey()) {
            return FloorPlanSyncResult(skipped = true, message = "No sync API key")
        }
        return try {
            val bootstrap = syncApi.bootstrap()
            val plans = bootstrap.floorPlans
            syncPreferences.setReservedTableIds(bootstrap.reservedTableIds)
            if (plans.isEmpty()) {
                return FloorPlanSyncResult(message = "No floor plans in cloud")
            }
            val count = tableOrderRepository.importFloorPlansFromSync(plans)
            FloorPlanSyncResult(tables = count, floors = plans.size, message = "Synced $count tables from panel")
        } catch (e: Exception) {
            Log.w(TAG, "Floor plan sync failed", e)
            FloorPlanSyncResult(error = e.message)
        }
    }

    companion object {
        private const val TAG = "FloorPlanSync"
    }
}

data class FloorPlanSyncResult(
    val floors: Int = 0,
    val tables: Int = 0,
    val skipped: Boolean = false,
    val message: String? = null,
    val error: String? = null
)
