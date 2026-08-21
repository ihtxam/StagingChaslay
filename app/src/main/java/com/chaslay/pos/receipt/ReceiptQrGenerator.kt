package com.chaslay.pos.receipt

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max

@Singleton
class ReceiptQrGenerator @Inject constructor() {
    /** Receipt thermal QR — ECC-M, integer module scale, no interpolation (avoids bold/blurry dots). */
    fun generateReceiptQrBitmap(url: String, size: Int): Bitmap =
        generateCrispQrBitmap(url, size, ErrorCorrectionLevel.M)

    fun generateQrBitmap(url: String, size: Int = 512, errorCorrection: ErrorCorrectionLevel? = null): Bitmap {
        return generateCrispQrBitmap(url, size, errorCorrection ?: ErrorCorrectionLevel.M)
    }

    private fun generateCrispQrBitmap(
        url: String,
        size: Int,
        errorCorrection: ErrorCorrectionLevel
    ): Bitmap {
        val writer = QRCodeWriter()
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to errorCorrection,
            EncodeHintType.MARGIN to 4,
            EncodeHintType.CHARACTER_SET to "UTF-8"
        )
        val matrix = writer.encode(url, BarcodeFormat.QR_CODE, 0, 0, hints)
        val modules = matrix.width
        val target = size.coerceAtLeast(modules)
        val scale = max(1, target / modules)
        val qrPx = modules * scale
        val canvas = ((target.coerceAtLeast(qrPx) + 7) / 8) * 8
        val bitmap = Bitmap.createBitmap(canvas, canvas, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        val origin = (canvas - qrPx) / 2
        for (y in 0 until modules) {
            for (x in 0 until modules) {
                if (matrix[x, y]) {
                    val x0 = origin + x * scale
                    val y0 = origin + y * scale
                    for (dy in 0 until scale) {
                        for (dx in 0 until scale) {
                            bitmap.setPixel(x0 + dx, y0 + dy, Color.BLACK)
                        }
                    }
                }
            }
        }
        return bitmap
    }
}
