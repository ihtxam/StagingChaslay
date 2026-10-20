package com.rebornsense.printbridge.print

import android.content.Context
import android.os.Build
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Sunmi built-in thermal (D3 Mini, D2s Plus, etc.). */
class SunmiInternalDriver : PrinterDriver {
    override val key: String = "sunmi-internal"

    private val serviceRef = AtomicReference<SunmiPrinterService?>(null)

    companion object {
        private const val RAW_CHUNK_SIZE = 4096
        private const val RAW_CHUNK_DELAY_MS = 15L
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
                }
            )
            latch.await(3, TimeUnit.SECONDS)
        } catch (_: Throwable) {
            // Not a Sunmi device or service unavailable
        }
    }

    override fun discover(context: Context): List<PrinterEndpoint> {
        if (!isSunmiDevice()) return emptyList()
        bindIfNeeded(context)
        if (serviceRef.get() == null) return emptyList()
        val label = "Sunmi built-in (${Build.MODEL})"
        return listOf(
            PrinterEndpoint(
                id = "sunmi:internal",
                name = label,
                connectionType = "sunmi-internal",
                driverKey = key,
                isDefault = true,
            )
        )
    }

    override fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit> {
        bindIfNeeded(context)
        val service = serviceRef.get()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return try {
            sendRawPaced(service, data)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun sendRawPaced(service: SunmiPrinterService, data: ByteArray) {
        runCatching { service.printerInit(null) }
        var offset = 0
        while (offset < data.size) {
            val end = minOf(offset + RAW_CHUNK_SIZE, data.size)
            service.sendRAWData(data.copyOfRange(offset, end), null)
            offset = end
            if (offset < data.size) {
                Thread.sleep(RAW_CHUNK_DELAY_MS)
            }
        }
    }

    private fun isSunmiDevice(): Boolean {
        return Build.MANUFACTURER.orEmpty().contains("SUNMI", ignoreCase = true)
    }
}
