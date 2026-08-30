package com.rebornsense.printbridge.scale

import android.content.Context
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import kotlinx.coroutines.delay

object AclasScaleReader {
    private const val BAUD_RATE = 9600

    fun listDevices(context: Context): List<ScaleUsbDevice> = ScaleUsbHelper.listDevices(context)

    suspend fun readOnce(
        context: Context,
        address: String,
        timeoutMs: Long = 3_000
    ): Result<ReadOutcome> {
        return try {
            val normalized = ScaleUsbHelper.normalizeStoredAddress(context, address.trim())
            if (normalized.isBlank()) error("usbAddress query param required")
            val manager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
                ?: error("USB not available on this device")
            val device = ScaleUsbHelper.resolveDevice(context, normalized)
                ?: error("Scale not found — connect Aclas via USB OTG")
            if (!manager.hasPermission(device)) {
                error("USB permission not granted — open Bridge Reborn and allow USB access")
            }
            val driver = findSerialDriver(manager, device)
                ?: error("No serial interface found on scale")
            val connection = manager.openDevice(device) ?: error("Could not open USB scale")
            val port = driver.ports.firstOrNull() ?: error("Scale serial port not found")
            try {
                port.open(connection)
                port.setParameters(BAUD_RATE, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
                port.dtr = true
                port.rts = true
                val buffer = ByteArray(256)
                val deadline = System.currentTimeMillis() + timeoutMs
                var latest: AclasScaleReading? = null
                while (System.currentTimeMillis() < deadline) {
                    val bytesRead = port.read(buffer, 500)
                    if (bytesRead > 0) {
                        AclasScaleProtocol.findLatestReading(buffer, bytesRead)?.let { reading ->
                            latest = reading
                        }
                    }
                    delay(50)
                }
                val resolved = ScaleUsbHelper.stableAddress(device)
                val reading = latest
                    ?: throw IllegalStateException("No stable reading from scale — check USB cable and power")
                Result.success(ReadOutcome(reading, resolved))
            } finally {
                runCatching { port.close() }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun findSerialDriver(manager: UsbManager, device: android.hardware.usb.UsbDevice): UsbSerialDriver? {
        val defaultDriver = UsbSerialProber.getDefaultProber().probeDevice(device)
        if (defaultDriver != null) return defaultDriver
        return UsbSerialProber.getDefaultProber().findAllDrivers(manager)
            .firstOrNull { it.device.deviceId == device.deviceId }
    }
}

data class ReadOutcome(
    val reading: AclasScaleReading,
    val resolvedUsbAddress: String
)
