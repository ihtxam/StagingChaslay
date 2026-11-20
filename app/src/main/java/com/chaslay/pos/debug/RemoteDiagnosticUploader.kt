package com.chaslay.pos.debug

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.device.DeviceIdProvider
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.DiagnosticReportRequest
import com.chaslay.pos.sync.DiagnosticUploadWorkScheduler
import dagger.Lazy
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

data class DiagnosticUploadStatus(
    val atMs: Long,
    val success: Boolean,
    val summary: String,
) {
    fun formatForUi(dateFormat: DateFormat = DateFormat.getDateTimeInstance()): String {
        if (atMs <= 0L) return ""
        val whenLabel = dateFormat.format(Date(atMs))
        val prefix = if (success) "OK" else "Failed"
        return "$prefix — $whenLabel — $summary"
    }
}

@Singleton
class RemoteDiagnosticUploader @Inject constructor(
    @ApplicationContext private val context: Context,
    @Named("diagnostic") private val diagnosticSyncApi: SyncApi,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val deviceIdProvider: DeviceIdProvider,
    private val posDiagnosticLogger: PosDiagnosticLogger,
    private val crashLogger: Lazy<CrashLogger>,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    fun lastUploadStatus(): DiagnosticUploadStatus {
        return DiagnosticUploadStatus(
            atMs = prefs.getLong(KEY_AT, 0L),
            success = prefs.getBoolean(KEY_OK, false),
            summary = prefs.getString(KEY_SUMMARY, "").orEmpty(),
        )
    }

    fun scheduleUploadPendingCrashFile(file: File, auto: Boolean, isCrash: Boolean) {
        scope.launch {
            val ok = uploadCrashFile(file, auto = auto, isCrash = isCrash)
            if (!ok) {
                DiagnosticUploadWorkScheduler.enqueueRetry(context)
            }
        }
    }

    /** After PIN login — short support bundle in background (does not block UI). */
    fun scheduleSessionDiagnosticUpload() {
        if (!syncApiKeyStore.hasKey()) return
        scope.launch {
            val result = runCatching { uploadSupportBundle(manual = false) }
            if (result.isFailure) {
                DiagnosticUploadWorkScheduler.enqueueRetry(context)
            }
        }
    }

    fun flushPendingCrashFiles(onEach: (Boolean) -> Unit = {}) {
        scope.launch {
            val dir = File(context.filesDir, "crashes")
            val pending = dir.listFiles()
                ?.filter { it.isFile && it.name.endsWith(".log") }
                ?.sortedBy { it.lastModified() }
                .orEmpty()
            var allOk = true
            for (file in pending) {
                val ok = uploadCrashFile(
                    file,
                    auto = true,
                    isCrash = file.name.startsWith("crash_"),
                )
                if (!ok) allOk = false
            }
            onEach(allOk)
        }
    }

    /** Manual upload from Settings — full session + crash index. */
    suspend fun uploadSupportBundle(manual: Boolean = true): Result<Unit> {
        if (!syncApiKeyStore.hasKey()) {
            val msg = context.getString(com.chaslay.pos.R.string.diagnostics_upload_need_api_key)
            recordStatus(success = false, summary = msg)
            return Result.failure(IllegalStateException(msg))
        }
        return try {
            val whenLabel =
                java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
            val subject = if (manual) {
                "Android POS support logs — $whenLabel"
            } else {
                "Android POS auto logs — $whenLabel"
            }
            val body = posDiagnosticLogger.buildSupportPayload(crashLogger.get())
            val deviceId = deviceIdProvider.getDeviceId()
            diagnosticSyncApi.postDiagnosticReport(
                syncApiKeyStore.resolvedKey(),
                DiagnosticReportRequest(
                    subject = subject,
                    body = body,
                    auto = !manual,
                    deviceId = deviceId,
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
            recordStatus(
                success = true,
                summary = context.getString(
                    com.chaslay.pos.R.string.diagnostics_upload_ok,
                    BuildConfig.DIAGNOSTIC_API_BASE_URL.trimEnd('/'),
                ),
            )
            Result.success(Unit)
        } catch (t: Throwable) {
            Log.w(TAG, "Manual diagnostic upload failed", t)
            val msg = t.message ?: t.javaClass.simpleName
            recordStatus(success = false, summary = msg)
            Result.failure(t)
        }
    }

    suspend fun uploadPendingCrashFilesBlocking(): Boolean {
        if (!syncApiKeyStore.hasKey()) return true
        val dir = File(context.filesDir, "crashes")
        val pending = dir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(".log") }
            ?.sortedBy { it.lastModified() }
            .orEmpty()
        if (pending.isEmpty()) return true
        var allOk = true
        for (file in pending) {
            val ok = uploadCrashFile(file, auto = true, isCrash = file.name.startsWith("crash_"))
            if (!ok) allOk = false
        }
        return allOk
    }

    private suspend fun uploadCrashFile(file: File, auto: Boolean, isCrash: Boolean): Boolean {
        if (!syncApiKeyStore.hasKey()) return false
        if (!file.exists() || !file.canRead()) return true
        return try {
            val deviceId = deviceIdProvider.getDeviceId()
            val whenLabel =
                java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
            val kind = if (isCrash) "crash" else "error"
            val subject = "Android POS $kind — $whenLabel"
            val body = DiagnosticLogUploader.redactSecrets(file.readText())
                .take(DiagnosticLogUploader.MAX_BODY_CHARS_FOR_UPLOAD)

            diagnosticSyncApi.postDiagnosticReport(
                syncApiKeyStore.resolvedKey(),
                DiagnosticReportRequest(
                    subject = subject,
                    body = body,
                    auto = auto,
                    deviceId = deviceId,
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
            if (!auto) {
                recordStatus(success = true, summary = "Uploaded ${file.name}")
            }
            file.delete()
            true
        } catch (t: Throwable) {
            Log.w(TAG, "Crash log upload failed for ${file.name}", t)
            false
        }
    }

    private fun recordStatus(success: Boolean, summary: String) {
        prefs.edit()
            .putLong(KEY_AT, System.currentTimeMillis())
            .putBoolean(KEY_OK, success)
            .putString(KEY_SUMMARY, summary.take(500))
            .apply()
    }

    companion object {
        private const val TAG = "RemoteDiagnosticUpload"
        private const val PREFS = "pos_diagnostic_upload"
        private const val KEY_AT = "last_at"
        private const val KEY_OK = "last_ok"
        private const val KEY_SUMMARY = "last_summary"
    }
}
