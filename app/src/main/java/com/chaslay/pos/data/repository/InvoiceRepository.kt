package com.chaslay.pos.data.repository

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import com.chaslay.pos.data.remote.InvoiceApi
import com.chaslay.pos.data.remote.InvoiceRecordPaymentRequest
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InvoiceRepository @Inject constructor(
    private val invoiceApi: InvoiceApi
) {
    suspend fun recordPayment(orderRef: String, paymentMethod: String): Result<Unit> = runCatching {
        val res = invoiceApi.recordPayment(orderRef, InvoiceRecordPaymentRequest(paymentMethod))
        if (!res.success) error("Could not record invoice payment")
    }

    suspend fun downloadAndOpen(
        context: Context,
        orderRef: String,
        filename: String = "invoice.pdf"
    ): Result<File> = runCatching {
        val body = invoiceApi.downloadPdf(orderRef)
        val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
        val safeName = filename.ifBlank { "invoice.pdf" }.replace(Regex("""[^\w.\-]"""), "_")
        val file = File(dir, safeName)
        body.byteStream().use { input ->
            file.outputStream().use { output -> input.copyTo(output) }
        }
        if (!file.exists() || file.length() <= 0L) {
            error("Invoice PDF is empty")
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (context !is android.app.Activity) {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
        try {
            val chooser = Intent.createChooser(viewIntent, safeName).apply {
                if (context !is android.app.Activity) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            context.startActivity(chooser)
        } catch (_: ActivityNotFoundException) {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (context !is android.app.Activity) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            context.startActivity(
                Intent.createChooser(shareIntent, safeName).apply {
                    if (context !is android.app.Activity) {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
            )
        }
        file
    }.onFailure { e ->
        Log.w(TAG, "Invoice PDF open failed", e)
    }

    companion object {
        private const val TAG = "InvoiceRepository"
    }
}
