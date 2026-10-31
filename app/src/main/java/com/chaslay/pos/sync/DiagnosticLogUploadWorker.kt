package com.chaslay.pos.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.chaslay.pos.debug.DiagnosticLogUploader
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class DiagnosticLogUploadWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val diagnosticLogUploader: DiagnosticLogUploader
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return if (diagnosticLogUploader.uploadPendingLogs()) {
            Result.success()
        } else {
            Result.retry()
        }
    }
}
