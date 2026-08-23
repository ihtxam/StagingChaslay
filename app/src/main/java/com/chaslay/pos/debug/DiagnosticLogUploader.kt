package com.chaslay.pos.debug

import android.content.Context
import android.util.Log
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.DiagnosticReportRequest
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
            uploadFile(logFile, auto, isCrash)
        }
    }

    /** Upload any crash/error logs saved locally (e.g. after login or when network returns). */
    fun flushPendingLogs() {
        scope.launch {
            val dir = File(context.filesDir, "crashes")
            val pending = dir.listFiles()
                ?.filter { it.isFile && it.name.endsWith(".log") }
                ?.sortedBy { it.lastModified() }
                .orEmpty()
            for (file in pending) {
                uploadFile(file, auto = true, isCrash = file.name.startsWith("crash_"))
            }
        }
    }

    private suspend fun uploadFile(file: File, auto: Boolean, isCrash: Boolean) {
        if (!syncApiKeyStore.hasKey()) return
        if (!file.exists() || !file.canRead()) return

        val now = System.currentTimeMillis()
        if (auto && !isCrash && now - lastAutoUploadMs < AUTO_SEND_COOLDOWN_MS) {
            return
        }

        try {
            val deviceId = deviceIdProvider.getDeviceId()
            val whenLabel = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
            val kind = if (isCrash) "crash" else "error"
            val subject = "Android POS $kind — $whenLabel"
            val body = file.readText().take(MAX_BODY_CHARS)

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
        } catch (t: Throwable) {
            Log.w(TAG, "Diagnostic log upload failed for ${file.name}", t)
        }
    }

    companion object {
        private const val TAG = "DiagnosticLogUploader"
        private const val AUTO_SEND_COOLDOWN_MS = 15 * 60 * 1000L
        private const val MAX_BODY_CHARS = 120_000
    }
}
