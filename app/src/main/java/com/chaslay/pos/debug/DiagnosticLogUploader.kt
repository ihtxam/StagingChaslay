package com.chaslay.pos.debug

import android.content.Context
import com.chaslay.pos.sync.DiagnosticUploadWorkScheduler
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@Singleton
class DiagnosticLogUploader @Inject constructor(
    @ApplicationContext private val context: Context,
    private val remoteDiagnosticUploader: RemoteDiagnosticUploader,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun scheduleUpload(logFile: File, auto: Boolean = true, isCrash: Boolean = false) {
        remoteDiagnosticUploader.scheduleUploadPendingCrashFile(logFile, auto, isCrash)
    }

    /** @return true when no pending `.log` files remain (or none to upload). */
    suspend fun uploadPendingLogs(): Boolean {
        val allOk = remoteDiagnosticUploader.uploadPendingCrashFilesBlocking()
        if (!allOk) DiagnosticUploadWorkScheduler.enqueueRetry(context)
        return allOk
    }

    /** Upload any crash/error logs saved locally (e.g. after login or when network returns). */
    fun flushPendingLogs() {
        scope.launch {
            remoteDiagnosticUploader.flushPendingCrashFiles { ok ->
                if (!ok) DiagnosticUploadWorkScheduler.enqueueRetry(context)
            }
        }
    }

    companion object {
        const val MAX_BODY_CHARS_FOR_UPLOAD = 120_000

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
