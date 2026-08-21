package com.chaslay.pos.data.repository

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

    suspend fun downloadAndOpen(context: Context, orderRef: String, filename: String = "invoice.pdf"): Result<Unit> =
        runCatching {
            val body = invoiceApi.downloadPdf(orderRef)
            val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
            val file = File(dir, filename.ifBlank { "invoice.pdf" })
            body.byteStream().use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(Intent.createChooser(intent, filename))
        }.onFailure { e ->
            Log.w(TAG, "Invoice PDF open failed", e)
        }

    companion object {
        private const val TAG = "InvoiceRepository"
    }
}
