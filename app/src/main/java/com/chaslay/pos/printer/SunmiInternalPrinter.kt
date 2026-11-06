package com.chaslay.pos.printer

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbConstants
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/** Sunmi built-in thermal (D2s Plus, D3 Mini, etc.) — not USB ESC/POS shadow. */
@Singleton
class SunmiInternalPrinter @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val serviceRef = AtomicReference<SunmiPrinterService?>(null)
    private val bindLock = Any()

    fun bindIfNeeded() {
        if (serviceRef.get() != null) return
        if (!isSunmiDevice()) return
        synchronized(bindLock) {
            if (serviceRef.get() != null) return
            runCatching {
                val latch = CountDownLatch(1)
                val callback = object : InnerPrinterCallback() {
                    override fun onConnected(service: SunmiPrinterService?) {
                        serviceRef.set(service)
                        latch.countDown()
                    }

                    override fun onDisconnected() {
                        serviceRef.set(null)
                    }
                }
                val appCtx = context.applicationContext
                if (Looper.myLooper() == Looper.getMainLooper()) {
                    InnerPrinterManager.getInstance().bindService(appCtx, callback)
                } else {
                    Handler(Looper.getMainLooper()).post {
                        runCatching {
                            InnerPrinterManager.getInstance().bindService(appCtx, callback)
                        }.onFailure {
                            Log.w(TAG, "Sunmi bindService failed", it)
                            latch.countDown()
                        }
                    }
                }
                latch.await(5, TimeUnit.SECONDS)
            }.onFailure {
                Log.w(TAG, "Sunmi printer bind failed", it)
            }
        }
    }

    fun isAvailable(): Boolean {
        if (!isSunmiDevice()) return false
        bindIfNeeded()
        return serviceRef.get() != null
    }

    fun sendRaw(data: ByteArray): Result<Unit> {
        bindIfNeeded()
        val service = serviceRef.get()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return runCatching {
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
    }

    companion object {
        private const val TAG = "SunmiInternalPrinter"
        const val INTERNAL_ADDRESS = "sunmi:internal"
        private const val RAW_CHUNK_SIZE = 4096
        private const val RAW_CHUNK_DELAY_MS = 15L

        private val SUNMI_INTERNAL_USB_NAME =
            Regex("""AX8772B|GD32-USB_Printer|InnerPrinter|Sunmi""", RegexOption.IGNORE_CASE)

        fun isSunmiDevice(): Boolean =
            Build.MANUFACTURER.orEmpty().contains("SUNMI", ignoreCase = true)

        fun isInternalAddress(address: String?): Boolean {
            val trimmed = address?.trim().orEmpty()
            return trimmed.equals(INTERNAL_ADDRESS, ignoreCase = true) ||
                trimmed.startsWith("sunmi:", ignoreCase = true)
        }

        /**
         * Sunmi D2/D3 expose built-in thermal as a USB gadget — ESC/POS over USB often prints
         * raster (QR) only; route through [SunmiInternalPrinter.sendRaw] instead.
         */
        fun isInternalUsbShadow(context: Context?, device: UsbDevice): Boolean {
            if (!isSunmiDevice()) return false
            val blob = buildString {
                append(device.productName.orEmpty())
                append(' ')
                append(device.manufacturerName.orEmpty())
            }
            if (blob.isNotEmpty() && SUNMI_INTERNAL_USB_NAME.containsMatchIn(blob)) return true
            if (hasPrinterClass(device) && !blob.contains("gd32", ignoreCase = true)) return false
            if (!hasPrinterClass(device) && hasAnyBulkOut(device) && !hasPrinterInterface(device)) {
                val classes = interfaceClasses(device)
                if (classes.isNotEmpty() && classes.all { it == UsbConstants.USB_CLASS_VENDOR_SPEC }) {
                    return true
                }
            }
            return false
        }

        fun builtInLabel(): String = "Sunmi built-in (${Build.MODEL})"

        private fun hasPrinterClass(device: UsbDevice): Boolean {
            if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
            return (0 until device.interfaceCount).any { index ->
                device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER
            }
        }

        private fun hasPrinterInterface(device: UsbDevice): Boolean =
            (0 until device.interfaceCount).any { index ->
                device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER
            }

        private fun hasAnyBulkOut(device: UsbDevice): Boolean =
            (0 until device.interfaceCount).any { index ->
                val iface = device.getInterface(index)
                (0 until iface.endpointCount).any { epIndex ->
                    val ep = iface.getEndpoint(epIndex)
                    ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                        ep.direction == UsbConstants.USB_DIR_OUT
                }
            }

        private fun interfaceClasses(device: UsbDevice): List<Int> =
            (0 until device.interfaceCount).map { device.getInterface(it).interfaceClass }
    }
}

enum class EscPosTextEncoding {
    CP850,
    UTF8,
}
