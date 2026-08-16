package com.chaslay.pos.sync

import android.content.Context
import android.os.Build
import android.util.Log
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.PosSessionApi
import com.chaslay.pos.data.remote.PosSessionHeartbeatRequest
import com.chaslay.pos.data.remote.PosSessionRegisterRequest
import com.chaslay.pos.data.remote.PosSessionRevokeRequest
import com.chaslay.pos.domain.model.UserAccess
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@Singleton
class PosSessionRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val posSessionApi: PosSessionApi,
    private val deviceIdProvider: DeviceIdProvider,
    private val syncApiKeyStore: SyncApiKeyStore,
) {
    private var sessionId: String? = null
    private var heartbeatJob: Job? = null
    private var heartbeatIntervalSec: Int = 45

    private fun deviceLabel(): String {
        val model = Build.MODEL?.trim().orEmpty()
        return if (model.isNotBlank()) "Android · $model" else "Android POS"
    }

    suspend fun registerAfterLogin(userId: String, userName: String, access: UserAccess) {
        if (syncApiKeyStore.current().isBlank() && syncApiKeyStore.currentBlocking().isBlank()) {
            return
        }
        val kind = if (access.isWaiterProfile()) "waiter" else "main"
        runCatching {
            val res = posSessionApi.register(
                PosSessionRegisterRequest(
                    sessionKind = kind,
                    deviceId = deviceIdProvider.getDeviceId(),
                    deviceLabel = deviceLabel(),
                    staffId = userId,
                    staffName = userName,
                )
            )
            sessionId = res.sessionId?.takeIf { it.isNotBlank() }
            heartbeatIntervalSec = (res.heartbeatIntervalSec ?: 45).coerceIn(15, 120)
            persistSessionId(sessionId)
        }.onFailure {
            Log.w(TAG, "POS session register failed", it)
        }
    }

    fun startHeartbeat(scope: CoroutineScope) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch(Dispatchers.IO) {
            while (isActive) {
                val sid = sessionId ?: readPersistedSessionId()
                if (!sid.isNullOrBlank()) {
                    runCatching {
                        posSessionApi.heartbeat(PosSessionHeartbeatRequest(sid))
                    }.onFailure {
                        Log.w(TAG, "POS session heartbeat failed", it)
                    }
                }
                delay(heartbeatIntervalSec * 1000L)
            }
        }
    }

    fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    suspend fun revoke() {
        stopHeartbeat()
        val sid = sessionId ?: readPersistedSessionId()
        sessionId = null
        clearPersistedSessionId()
        if (syncApiKeyStore.current().isBlank() && syncApiKeyStore.currentBlocking().isBlank()) {
            return
        }
        runCatching {
            if (!sid.isNullOrBlank()) {
                posSessionApi.revoke(PosSessionRevokeRequest(sessionId = sid))
            } else {
                posSessionApi.revoke(
                    PosSessionRevokeRequest(deviceId = deviceIdProvider.getDeviceId())
                )
            }
        }.onFailure {
            Log.w(TAG, "POS session revoke failed", it)
        }
    }

    private fun persistSessionId(id: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SESSION, id)
            .apply()
    }

    private fun readPersistedSessionId(): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SESSION, null)
            ?.takeIf { it.isNotBlank() }

    private fun clearPersistedSessionId() {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_SESSION)
            .apply()
    }

    companion object {
        private const val TAG = "PosSessionRepository"
        private const val PREFS = "pos_session"
        private const val KEY_SESSION = "session_id"
    }
}
