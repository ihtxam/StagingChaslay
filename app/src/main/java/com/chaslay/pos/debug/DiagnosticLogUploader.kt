package com.chaslay.pos.debug

import android.content.Context
import android.util.Log
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.DiagnosticReportRequest
import com.chaslay.pos.sync.DiagnosticUploadWorkScheduler
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@Singleton
class DiagnosticLogUploader @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncApi: SyncApi,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val deviceIdProvider: DeviceIdProvider
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var lastAutoUploadMs = 0L

    fun scheduleUpload(logFile: File, auto: Boolean = true, isCrash: Boolean = false) {
        scope.launch {
            val ok = uploadFile(logFile, auto, isCrash)
            if (!ok) DiagnosticUploadWorkScheduler.enqueueRetry(context)
        }
    }

    /** @return true when no pending `.log` files remain (or none to upload). */
    suspend fun uploadPendingLogs(): Boolean {
        if (!syncApiKeyStore.hasKey()) return true
        val dir = File(context.filesDir, "crashes")
        val pending = dir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(".log") }
            ?.sortedBy { it.lastModified() }
            .orEmpty()
        if (pending.isEmpty()) return true
        var allOk = true
        for (file in pending) {
            val ok = uploadFile(file, auto = true, isCrash = file.name.startsWith("crash_"))
            if (!ok) allOk = false
        }
        return allOk
    }

    /** Upload any crash/error logs saved locally (e.g. after login or when network returns). */
    fun flushPendingLogs() {
        scope.launch {
            val ok = uploadPendingLogs()
            if (!ok) DiagnosticUploadWorkScheduler.enqueueRetry(context)
        }
    }

    private suspend fun uploadFile(file: File, auto: Boolean, isCrash: Boolean): Boolean {
        if (!syncApiKeyStore.hasKey()) return false
        if (!file.exists() || !file.canRead()) return true

        val now = System.currentTimeMillis()
        if (auto && !isCrash && now - lastAutoUploadMs < AUTO_SEND_COOLDOWN_MS) {
            return true
        }

        return try {
            val deviceId = deviceIdProvider.getDeviceId()
            val whenLabel = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
            val kind = if (isCrash) "crash" else "error"
            val subject = "Android POS $kind — $whenLabel"
            val body = redactSecrets(file.readText()).take(MAX_BODY_CHARS)

            syncApi.postDiagnosticReport(
                DiagnosticReportRequest(
                    subject = subject,
                    body = body,
                    auto = auto,
                    deviceId = deviceId,
                    appVersion = BuildConfig.VERSION_NAME
                )
            )

            if (auto) lastAutoUploadMs = now
            file.delete()
            true
        } catch (t: Throwable) {
            Log.w(TAG, "Diagnostic log upload failed for ${file.name}", t)
            false
        }
    }

    companion object {
        private const val TAG = "DiagnosticLogUploader"
        private const val AUTO_SEND_COOLDOWN_MS = 15 * 60 * 1000L
        private const val MAX_BODY_CHARS = 120_000

        private val SECRET_PATTERNS = listOf(
            Regex("(?i)(api[_-]?key|authorization|bearer|password|pin|secret|token)\\s*[:=]\\s*\\S+"),
            Regex("(?i)(x-api-key)\\s*[:=]\\s*\\S+")
        )

        internal fun redactSecrets(text: String): String {
            var out = text
            for (pattern in SECRET_PATTERNS) {
                out = pattern.replace(out) { match ->
                    val label = match.value.substringBefore('=').substringBefore(':').trim()
                    "$label: [redacted]"
                }
            }
            return out
        }
    }
}
