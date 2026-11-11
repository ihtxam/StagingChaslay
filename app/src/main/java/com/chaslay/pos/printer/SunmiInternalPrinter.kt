package com.chaslay.pos.printer

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbConstants
import android.util.Log
import java.util.Locale
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Sunmi built-in thermal (D2s Plus, D3 Mini, etc.) — not USB ESC/POS shadow. */
@Singleton
class SunmiInternalPrinter @Inject constructor(
    @ApplicationContext private val context: Context,
    private val serviceHolder: SunmiPrinterServiceHolder,
) {
    fun bindIfNeeded() = serviceHolder.bindIfNeeded()

    fun isAvailable(): Boolean {
        if (!isSunmiDevice()) return false
        bindIfNeeded()
        return serviceHolder.isServiceConnected()
    }

    fun sendRaw(data: ByteArray): Result<Unit> {
        bindIfNeeded()
        val service = serviceHolder.getService()
            ?: return Result.failure(IllegalStateException("Sunmi printer service not connected"))
        return runCatching {
            // Payload already leads with ESC @; a second printerInit can blank some D3 firmware.
            val skipInit = data.size >= 2 && data[0] == 0x1B.toByte() && data[1] == 0x40.toByte()
            if (!skipInit) {
                runCatching { service.printerInit(null) }
            }
            var offset = 0
            while (offset < data.size) {
                val rawEnd = minOf(offset + RAW_CHUNK_SIZE, data.size)
                val end = alignUtf8ChunkEnd(data, offset, rawEnd)
                service.sendRAWData(data.copyOfRange(offset, end), null)
                offset = end
                if (offset < data.size) {
                    Thread.sleep(RAW_CHUNK_DELAY_MS)
                }
            }
            val chunkCount = (data.size + RAW_CHUNK_SIZE - 1) / RAW_CHUNK_SIZE
            val prefixHex = data.take(24).joinToString(" ") { b -> "%02X".format(b.toInt() and 0xFF) }
            val msg = buildString {
                append("sendRaw ok bytes=")
                append(data.size)
                append(" chunks=")
                append(chunkCount)
                append(" profile=")
                append(serviceHolder.deviceProfile())
                append(" head=")
                append(prefixHex)
            }
            Log.d(TAG, msg)
            Unit
        }.onFailure { t ->
            Log.w(TAG, "sendRaw failed", t)
        }
    }

    /** Avoid splitting UTF-8 multibyte sequences across sendRAWData chunks (D3 garbles or drops text). */
    private fun alignUtf8ChunkEnd(data: ByteArray, offset: Int, proposedEnd: Int): Int {
        if (proposedEnd >= data.size) return proposedEnd
        var end = proposedEnd
        while (end > offset && (data[end - 1].toInt() and 0xC0) == 0x80) {
            end--
        }
        return if (end == offset) proposedEnd else end
    }

    companion object {
        private const val TAG = "SunmiInternalPrinter"
        const val INTERNAL_ADDRESS = "sunmi:internal"
        /** Fake bonded BT address Sunmi uses for the USB InnerPrinter facade on D3 Mini. */
        const val INTERNAL_BLUETOOTH_SHADOW_MAC = "00:11:22:33:44:55"
        private const val RAW_CHUNK_SIZE = 4096
        private const val RAW_CHUNK_DELAY_MS = 15L

        private val SUNMI_INTERNAL_USB_NAME =
            Regex("""AX8772B|GD32-USB_Printer|InnerPrinter|Sunmi|Printer""", RegexOption.IGNORE_CASE)
        private val INNER_PRINTER_NAME = Regex("""InnerPrinter""", RegexOption.IGNORE_CASE)
        private val MAC_ADDRESS = Regex("""^([0-9A-F]{2}:){5}[0-9A-F]{2}$""")

        fun isSunmiDevice(): Boolean =
            serviceHolderManufacturer().contains("SUNMI", ignoreCase = true)

        private fun serviceHolderManufacturer(): String =
            android.os.Build.MANUFACTURER.orEmpty()

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
                append(" vid=")
                append(device.vendorId)
                append(" pid=")
                append(device.productId)
            }
            if (blob.isNotEmpty() && SUNMI_INTERNAL_USB_NAME.containsMatchIn(blob)) return true
            // On Sunmi POS hardware, any USB printer-class interface is the internal thermal facade.
            if (hasPrinterClass(device)) return true
            if (!hasPrinterClass(device) && hasAnyBulkOut(device) && !hasPrinterInterface(device)) {
                val classes = interfaceClasses(device)
                if (classes.isNotEmpty() && classes.all { it == UsbConstants.USB_CLASS_VENDOR_SPEC }) {
                    return true
                }
            }
            return false
        }

        fun builtInLabel(): String = "Sunmi built-in (${android.os.Build.MODEL})"

        fun builtInPickerLabel(): String = "${builtInLabel()} (use this)"

        fun looksLikeInnerPrinterLabel(name: String?): Boolean =
            INNER_PRINTER_NAME.containsMatchIn(name.orEmpty())

        /** Stored row that should use [INTERNAL_ADDRESS] and connection type SUNMI. */
        fun shouldMigrateStoredPrinter(
            address: String?,
            name: String?,
            connectionType: String?,
        ): Boolean {
            if (!isSunmiDevice()) return false
            if (isInternalAddress(address) && connectionType?.trim().equals("SUNMI", ignoreCase = true)) {
                return false
            }
            if (isInternalAddress(address) && !connectionType.isNullOrBlank() &&
                !connectionType.trim().equals("SUNMI", ignoreCase = true)
            ) {
                return true
            }
            return looksLikeStoredSunmiInnerShadow(address, name) ||
                isInternalBluetoothShadow(address, name)
        }

        fun migratedPrinterEntity(name: String?): Pair<String, String> {
            val label = when {
                looksLikeInnerPrinterLabel(name) || name.isNullOrBlank() -> builtInLabel()
                else -> name.trim()
            }
            return label to "SUNMI"
        }

        fun displayNameForSettings(name: String?, address: String?, connectionType: String?): String {
            if (!isSunmiDevice()) return name.orEmpty()
            if (isInternalAddress(address) || connectionType.equals("SUNMI", ignoreCase = true)) {
                if (looksLikeInnerPrinterLabel(name) || name.isNullOrBlank()) return builtInLabel()
            }
            if (looksLikeStoredSunmiInnerShadow(address, name)) return builtInLabel()
            return name.orEmpty()
        }

        fun normalizeBluetoothMac(address: String?): String =
            address?.trim()?.replace('-', ':')?.uppercase(Locale.US).orEmpty()

        /**
         * Sunmi exposes the built-in printer as a paired "InnerPrinter" Bluetooth device — not ESC/POS BT.
         */
        fun isInternalBluetoothShadow(address: String?, name: String? = null): Boolean {
            if (!isSunmiDevice()) return false
            if (isInternalAddress(address)) return false
            val mac = normalizeBluetoothMac(address)
            if (mac == INTERNAL_BLUETOOTH_SHADOW_MAC) return true
            if (mac.isNotBlank() && MAC_ADDRESS.matches(mac) && INNER_PRINTER_NAME.containsMatchIn(name.orEmpty())) {
                return true
            }
            val blob = buildString {
                append(mac)
                append(' ')
                append(name.orEmpty())
            }
            return mac.isNotBlank() && MAC_ADDRESS.matches(mac) && INNER_PRINTER_NAME.containsMatchIn(blob)
        }

        /** Stored USB address/name that matched Sunmi built-in before service bind (startup migration). */
        fun looksLikeStoredSunmiInnerUsb(address: String?, name: String? = null): Boolean {
            if (!isSunmiDevice()) return false
            if (isInternalAddress(address)) return false
            val addr = address?.trim().orEmpty()
            if (addr.isBlank() || !addr.startsWith("usb:", ignoreCase = true)) return false
            val blob = buildString {
                append(addr)
                append(' ')
                append(name.orEmpty())
            }
            return SUNMI_INTERNAL_USB_NAME.containsMatchIn(blob)
        }

        /** USB gadget or fake Bluetooth entry that should map to [INTERNAL_ADDRESS]. */
        fun looksLikeStoredSunmiInnerShadow(address: String?, name: String? = null): Boolean =
            looksLikeStoredSunmiInnerUsb(address, name) ||
                isInternalBluetoothShadow(address, name)

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
