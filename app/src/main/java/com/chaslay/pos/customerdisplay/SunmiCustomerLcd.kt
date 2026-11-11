package com.chaslay.pos.customerdisplay

import android.content.Context
import android.os.Build
import android.util.Log
import com.chaslay.pos.printer.SunmiInternalPrinter
import com.chaslay.pos.printer.SunmiPrinterServiceHolder
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SunmiCustomerLcd @Inject constructor(
    private val serviceHolder: SunmiPrinterServiceHolder,
) {
    private val lcdAvailable = AtomicReference<Boolean?>(null)

    companion object {
        private const val TAG = "SunmiCustomerLcd"
        private const val LCD_LINE_MAX = 20
    }

    fun bindIfNeeded(context: Context) {
        serviceHolder.bindIfNeeded()
    }

    fun isLikelyCustomerLcdDevice(): Boolean {
        if (!SunmiInternalPrinter.isSunmiDevice()) return false
        val model = Build.MODEL.orEmpty().uppercase()
        return model.contains("D3") ||
            model.contains("MINI") ||
            model.contains("T1MINI") ||
            model.contains("T2MINI")
    }

    fun customerLcdAvailable(context: Context): Boolean {
        val cached = lcdAvailable.get()
        if (cached != null) return cached
        if (!isLikelyCustomerLcdDevice()) {
            lcdAvailable.set(false)
            return false
        }
        bindIfNeeded(context)
        val service = serviceHolder.getService()
        if (service == null) {
            lcdAvailable.set(false)
            Log.w(TAG, "No Sunmi service for LCD (${serviceHolder.deviceProfile()})")
            return false
        }
        val ok = probeLcdWake(service)
        lcdAvailable.set(ok)
        if (!ok) Log.w(TAG, "Sunmi customer LCD probe failed (${serviceHolder.deviceProfile()})")
        return ok
    }

    fun invalidateLcdCache() {
        lcdAvailable.set(null)
    }

    fun showCustomerLcd(context: Context, topText: String, bottomText: String): Result<Unit> {
        bindIfNeeded(context)
        val service = serviceHolder.getService()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return try {
            val top = sanitizeLcdLine(topText)
            val bottom = sanitizeLcdLine(bottomText)
            service.sendLCDCommand(2)
            service.sendLCDDoubleString(top, bottom, null)
            lcdAvailable.set(true)
            Log.i(TAG, "LCD show: \"$top\" / \"$bottom\"")
            Result.success(Unit)
        } catch (e: Exception) {
            lcdAvailable.set(null)
            Result.failure(e)
        }
    }

    fun clearCustomerLcd(context: Context): Result<Unit> {
        bindIfNeeded(context)
        val service = serviceHolder.getService()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return try {
            service.sendLCDCommand(4)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun probeLcdWake(service: SunmiPrinterService): Boolean {
        return try {
            service.sendLCDCommand(2)
            true
        } catch (_: Throwable) {
            false
        }
    }

    private fun sanitizeLcdLine(raw: String): String {
        val collapsed = raw.replace('\n', ' ').trim()
        if (collapsed.length <= LCD_LINE_MAX) return collapsed
        return collapsed.take(LCD_LINE_MAX - 1) + "…"
    }
}
