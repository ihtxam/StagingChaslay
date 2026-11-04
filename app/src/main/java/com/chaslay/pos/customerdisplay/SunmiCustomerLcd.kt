package com.chaslay.pos.customerdisplay

import android.content.Context
import android.os.Build
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SunmiCustomerLcd @Inject constructor() {
    private val serviceRef = AtomicReference<SunmiPrinterService?>(null)
    private val lcdAvailable = AtomicReference<Boolean?>(null)

    companion object {
        private const val LCD_LINE_MAX = 20
    }

    fun bindIfNeeded(context: Context) {
        if (serviceRef.get() != null) return
        if (!isSunmiDevice()) return
        try {
            val latch = CountDownLatch(1)
            InnerPrinterManager.getInstance().bindService(
                context.applicationContext,
                object : InnerPrinterCallback() {
                    override fun onConnected(service: SunmiPrinterService?) {
                        serviceRef.set(service)
                        latch.countDown()
                    }

                    override fun onDisconnected() {
                        serviceRef.set(null)
                    }
                },
            )
            latch.await(3, TimeUnit.SECONDS)
        } catch (_: Throwable) {
            // Not a Sunmi device or service unavailable
        }
    }

    fun isLikelyCustomerLcdDevice(): Boolean {
        if (!isSunmiDevice()) return false
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
        val service = serviceRef.get()
        if (service == null) {
            lcdAvailable.set(false)
            return false
        }
        val ok = probeLcdWake(service)
        lcdAvailable.set(ok)
        return ok
    }

    fun showCustomerLcd(context: Context, topText: String, bottomText: String): Result<Unit> {
        bindIfNeeded(context)
        val service = serviceRef.get()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return try {
            val top = sanitizeLcdLine(topText)
            val bottom = sanitizeLcdLine(bottomText)
            service.sendLCDCommand(2)
            service.sendLCDDoubleString(top, bottom, null)
            lcdAvailable.set(true)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun clearCustomerLcd(context: Context): Result<Unit> {
        bindIfNeeded(context)
        val service = serviceRef.get()
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

    private fun isSunmiDevice(): Boolean =
        Build.MANUFACTURER.orEmpty().contains("SUNMI", ignoreCase = true)
}
