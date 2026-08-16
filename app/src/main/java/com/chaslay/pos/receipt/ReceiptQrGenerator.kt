package com.chaslay.pos.receipt

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReceiptQrGenerator @Inject constructor() {
    /** Receipt thermal QR — EC-L keeps dots scannable while shrinking the matrix vs M. */
    fun generateReceiptQrBitmap(url: String, size: Int): Bitmap =
        generateQrBitmap(url, size, ErrorCorrectionLevel.L)

    fun generateQrBitmap(url: String, size: Int = 512, errorCorrection: ErrorCorrectionLevel? = null): Bitmap {
        val writer = QRCodeWriter()
        val hints = errorCorrection?.let { mapOf(EncodeHintType.ERROR_CORRECTION to it) }.orEmpty()
        val matrix = writer.encode(url, BarcodeFormat.QR_CODE, size, size, hints)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        return bitmap
    }
}
