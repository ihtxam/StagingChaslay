package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.local.dao.ReservationDao
import com.chaslay.pos.data.local.entity.ReservationEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.ReservationActionRequest
import com.chaslay.pos.data.remote.dto.ReservationsConfigRequest
import com.chaslay.pos.data.remote.dto.SyncReservationDto
import com.chaslay.pos.util.parseApiErrorMessage
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.domain.model.PosMode
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class ReservationSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val syncPreferences: SyncPreferences,
    private val reservationDao: ReservationDao,
    private val settingsRepository: SettingsRepository,
    private val floorSyncEvents: FloorSyncEvents,
    private val orderAlertNotifier: OrderAlertNotifier
) {
    suspend fun setModuleEnabled(enabled: Boolean): ReservationRemoteResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext ReservationRemoteResult(
                success = false,
                offline = true,
                error = "Not linked to cloud"
            )
        }
        return@withContext try {
            syncApi.updateReservationsConfig(ReservationsConfigRequest(enabled = enabled))
            val settings = settingsRepository.getSettings().copy(reservationsEnabled = enabled)
            settingsRepository.saveSettings(settings)
            ReservationRemoteResult(success = true)
        } catch (e: Exception) {
            Log.w(TAG, "Update reservations module failed", e)
            ReservationRemoteResult(success = false, error = parseApiErrorMessage(e, "Request failed"))
        }
    }

    suspend fun performAction(
        reservationId: String,
        action: String,
        cancelReason: String? = null,
        sendRejectionEmail: Boolean? = null
    ): ReservationRemoteResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext ReservationRemoteResult(
                success = false,
                offline = true,
                error = "Not linked to cloud"
            )
        }
        return@withContext try {
            syncApi.reservationAction(
                reservationId,
                ReservationActionRequest(
                    action = action,
                    cancelReason = cancelReason?.takeIf { it.isNotBlank() },
                    sendRejectionEmail = sendRejectionEmail
                )
            )
            syncReservations()
            ReservationRemoteResult(success = true)
        } catch (e: Exception) {
            Log.w(TAG, "Reservation action failed: $action", e)
            ReservationRemoteResult(success = false, error = parseApiErrorMessage(e, "Request failed"))
        }
    }

    suspend fun syncReservations(): ReservationSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext ReservationSyncResult(skipped = true)
        }
        val settings = settingsRepository.getSettings()
        if (settings.posMode == PosMode.RETAIL || !settings.reservationsEnabled) {
            reservationDao.deleteAll()
            syncPreferences.setReservedTableIds(emptySet())
            floorSyncEvents.notifyTableOrdersChanged()
            return@withContext ReservationSyncResult(cleared = true)
        }
        return@withContext try {
            val response = syncApi.reservations()
            val now = System.currentTimeMillis()
            val entities = response.reservations.mapNotNull { it.toEntity(now) }
            val knownIds = reservationDao.getAllIds().toSet()
            val baseline = syncPreferences.isReservationNotifyBaseline()
            val newPending = entities.count { entity ->
                entity.id !in knownIds && entity.status.equals("pending", ignoreCase = true)
            }
            if (entities.isEmpty()) {
                reservationDao.deleteAll()
            } else {
                reservationDao.upsertAll(entities)
                val ids = entities.map { it.id }
                reservationDao.deleteNotIn(ids)
            }
            syncPreferences.setReservedTableIds(response.reservedTableIds.toSet())
            floorSyncEvents.notifyTableOrdersChanged()
            if (!baseline) {
                syncPreferences.setReservationNotifyBaseline()
            } else if (newPending > 0) {
                orderAlertNotifier.notifyNewReservations(newPending)
            }
            ReservationSyncResult(
                count = entities.size,
                serverTime = response.serverTime,
                message = "Synced ${entities.size} reservations"
            )
        } catch (e: Exception) {
            Log.w(TAG, "Reservation sync failed", e)
            ReservationSyncResult(error = e.message)
        }
    }

    private fun SyncReservationDto.toEntity(syncedAtMs: Long): ReservationEntity? {
        val atMs = parseReservedAtMs(reservedAt) ?: return null
        return ReservationEntity(
            id = id,
            code = code,
            guestName = guestName,
            guestPhone = guestPhone,
            guestEmail = guestEmail,
            partySize = partySize.coerceAtLeast(1),
            reservedAtMs = atMs,
            status = status,
            tableRemoteId = tableId,
            tableLabel = tableLabel,
            notes = notes?.takeIf { it.isNotBlank() } ?: internalNotes?.takeIf { it.isNotBlank() },
            source = source,
            syncedAtMs = syncedAtMs
        )
    }

    companion object {
        private const val TAG = "ReservationSync"

        fun parseReservedAtMs(iso: String): Long? {
            val trimmed = iso.trim()
            if (trimmed.isEmpty()) return null
            return runCatching { Instant.parse(trimmed).toEpochMilli() }.getOrNull()
        }
    }
}

data class ReservationRemoteResult(
    val success: Boolean,
    val offline: Boolean = false,
    val error: String? = null
)

data class ReservationSyncResult(
    val count: Int = 0,
    val serverTime: Long = 0L,
    val skipped: Boolean = false,
    val cleared: Boolean = false,
    val message: String? = null,
    val error: String? = null
)
