package com.rebornsense.printbridge.print

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.util.UUID
import kotlin.math.ceil

/**
 * Niimbot label protocol (K3 / B21 / B1). Not ESC/POS.
 * Aligned with print-agent/niimbot-client.js (niimprint + niimbluelib print tasks).
 */
object NiimbotPrintClient {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private val CONNECT_BYTES = byteArrayOf(0x03, 0x55, 0x55, 0xc1.toByte(), 0x01, 0x01, 0xc1.toByte(), 0xaa.toByte(), 0xaa.toByte())
    private val WAKE_BYTES = byteArrayOf(0x54, 0x01)

    private enum class Profile(val startPrint: ByteArray, val dimBytes: Int, val countsTotal: Boolean, val statusPolls: Int) {
        K3(byteArrayOf(1), 4, true, 8),
        B21(byteArrayOf(1), 4, true, 10),
        B1(byteArrayOf(0, 1, 0, 0, 0, 0, 0), 6, false, 10),
    }

    fun isNiimbotPayload(data: ByteArray): Boolean =
        data.size >= 2 && data[0] == 0x55.toByte() && data[1] == 0x55.toByte()

    fun isNiimbotPrinterName(name: String?): Boolean {
        val n = name.orEmpty().lowercase()
        return Regex("""niimbot|niimbus|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b""").containsMatchIn(n)
    }

    private fun detectProfile(name: String?): Profile {
        val blob = name.orEmpty().lowercase()
        if (Regex("""\bb1\b""").containsMatchIn(blob)) return Profile.B1
        if (Regex("""niimbus|b21s""").containsMatchIn(blob)) return Profile.B1
        if (Regex("""\bb21\b|\bd11\b|\bd110\b""").containsMatchIn(blob)) return Profile.B21
        return Profile.K3
    }

    fun print(
        context: Context,
        endpoint: PrinterEndpoint,
        registry: DriverRegistry,
        bitmap: ByteArray,
        widthPx: Int,
        heightPx: Int,
        density: Int = 3,
    ): Result<Unit> {
        return when (endpoint.connectionType) {
            "bluetooth" -> printBluetooth(context, endpoint, bitmap, widthPx, heightPx, density)
            else -> {
                val driver = registry.driverFor(endpoint) ?: return Result.failure(IllegalStateException("Driver missing"))
                val packets = buildAllPackets(bitmap, widthPx, heightPx, density, endpoint.name)
                val payload = CONNECT_BYTES + WAKE_BYTES + packets.reduce { acc, bytes -> acc + bytes }
                driver.print(context, endpoint, payload)
            }
        }
    }

    private fun packet(type: Int, data: ByteArray): ByteArray {
        val len = data.size
        var checksum = type xor len
        for (b in data) checksum = checksum xor (b.toInt() and 0xff)
        val out = ByteArray(7 + len)
        out[0] = 0x55
        out[1] = 0x55
        out[2] = type.toByte()
        out[3] = len.toByte()
        System.arraycopy(data, 0, out, 4, len)
        out[4 + len] = checksum.toByte()
        out[5 + len] = 0xaa.toByte()
        out[6 + len] = 0xaa.toByte()
        return out
    }

    private fun transceive(out: OutputStream, input: InputStream?, type: Int, data: ByteArray) {
        val pkt = packet(type, data)
        out.write(pkt)
        out.flush()
        if (input == null) {
            Thread.sleep(60)
            return
        }
        val buf = ByteArray(256)
        repeat(6) {
            Thread.sleep(80)
            val read = try {
                input.read(buf)
            } catch (_: Exception) {
                0
            }
            if (read >= 4 && buf[0] == 0x55.toByte() && buf[1] == 0x55.toByte()) {
                return
            }
        }
    }

    private const val PRINTHEAD_PX = 384

    private fun padBitmapToPrinthead(bitmap: ByteArray, widthPx: Int, heightPx: Int): Pair<ByteArray, Int> {
        val destW = PRINTHEAD_PX
        val destRowBytes = ceil(destW / 8.0).toInt()
        val srcW = widthPx.coerceAtLeast(1)
        val srcRowBytes = ceil(srcW / 8.0).toInt()
        val rows = heightPx.coerceAtLeast(1)
        if (srcRowBytes == destRowBytes && bitmap.size >= destRowBytes * rows) {
            return bitmap.copyOf(destRowBytes * rows) to destW
        }
        val out = ByteArray(destRowBytes * rows)
        val copyBytes = minOf(srcRowBytes, destRowBytes)
        for (y in 0 until rows) {
            val srcOff = y * srcRowBytes
            if (srcOff >= bitmap.size) break
            val n = minOf(copyBytes, bitmap.size - srcOff)
            System.arraycopy(bitmap, srcOff, out, y * destRowBytes, n)
        }
        return out to destW
    }

    private fun lineCounts(line: ByteArray, totalMode: Boolean): Triple<Int, Int, Int> {
        var total = 0
        for (b in line) {
            var value = b.toInt() and 0xff
            for (bit in 0 until 8) {
                if (value and (1 shl bit) != 0) total++
            }
        }
        return if (totalMode) Triple(0, total and 0xff, (total shr 8) and 0xff) else Triple(0, 0, 0)
    }

    private fun dimensionBytes(profile: Profile, rowsPx: Int, colsPx: Int): ByteArray {
        return if (profile.dimBytes == 4) {
            ByteBuffer.allocate(4).apply {
                putShort(rowsPx.toShort())
                putShort(colsPx.toShort())
            }.array()
        } else {
            ByteBuffer.allocate(6).apply {
                putShort(rowsPx.toShort())
                putShort(colsPx.toShort())
                putShort(1)
            }.array()
        }
    }

    private fun buildAllPackets(bitmap: ByteArray, widthPx: Int, heightPx: Int, density: Int, printerName: String?): List<ByteArray> {
        val profile = detectProfile(printerName)
        val d = density.coerceIn(1, 5)
        val (aligned, colsPx) = padBitmapToPrinthead(bitmap, widthPx, heightPx)
        val rowsPx = heightPx.coerceAtLeast(1)
        val packets = mutableListOf<ByteArray>()
        packets += packet(0x21, byteArrayOf(d.toByte()))
        packets += packet(0x23, byteArrayOf(1))
        packets += packet(0x01, profile.startPrint)
        packets += packet(0xA3, byteArrayOf(1))
        packets += packet(0x03, byteArrayOf(1))
        packets += packet(0x13, dimensionBytes(profile, rowsPx, colsPx))
        val rowBytes = ceil(colsPx / 8.0).toInt()
        for (y in 0 until rowsPx) {
            val rowStart = y * rowBytes
            val line = aligned.copyOfRange(rowStart, rowStart + rowBytes)
            val (c0, c1, c2) = lineCounts(line, profile.countsTotal)
            val header = ByteBuffer.allocate(6).apply {
                putShort(y.toShort())
                put(c0.toByte())
                put(c1.toByte())
                put(c2.toByte())
                put(1)
            }.array()
            packets += packet(0x85, header + line)
        }
        packets += packet(0xE3, byteArrayOf(1))
        repeat(profile.statusPolls.coerceAtMost(3)) { packets += packet(0xA3, byteArrayOf(1)) }
        packets += packet(0xF3, byteArrayOf(1))
        return packets
    }

    private fun printBluetooth(
        context: Context,
        endpoint: PrinterEndpoint,
        bitmap: ByteArray,
        widthPx: Int,
        heightPx: Int,
        density: Int,
    ): Result<Unit> {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
            ?: return Result.failure(IllegalStateException("Bluetooth unavailable"))
        val address = endpoint.meta["address"] ?: return Result.failure(IllegalStateException("Missing BT address"))
        val device = adapter.bondedDevices?.firstOrNull { it.address == address }
            ?: return Result.failure(IllegalStateException("Bluetooth printer not paired"))
        val profile = detectProfile(endpoint.name)
        return try {
            adapter.cancelDiscovery()
            val socket = device.createInsecureRfcommSocketToServiceRecord(sppUuid)
            socket.connect()
            try {
                val out = socket.outputStream
                val input = socket.inputStream
                out.write(CONNECT_BYTES)
                out.flush()
                Thread.sleep(40)
                out.write(WAKE_BYTES)
                out.flush()
                Thread.sleep(80)
                val d = density.coerceIn(1, 5).toByte()
                transceive(out, input, 0x21, byteArrayOf(d))
                transceive(out, input, 0x23, byteArrayOf(1))
                transceive(out, input, 0x01, profile.startPrint)
                transceive(out, input, 0xA3, byteArrayOf(1))
                transceive(out, input, 0x03, byteArrayOf(1))
                val (aligned, colsPx) = padBitmapToPrinthead(bitmap, widthPx, heightPx)
                transceive(out, input, 0x13, dimensionBytes(profile, heightPx, colsPx))
                val rowBytes = ceil(colsPx / 8.0).toInt()
                for (y in 0 until heightPx) {
                    val rowStart = y * rowBytes
                    val line = aligned.copyOfRange(rowStart, rowStart + rowBytes)
                    val (c0, c1, c2) = lineCounts(line, profile.countsTotal)
                    val header = ByteBuffer.allocate(6).apply {
                        putShort(y.toShort())
                        put(c0.toByte()); put(c1.toByte()); put(c2.toByte()); put(1)
                    }.array()
                    out.write(packet(0x85, header + line))
                    out.flush()
                    Thread.sleep(12)
                }
                transceive(out, input, 0xE3, byteArrayOf(1))
                Thread.sleep(200)
                repeat(profile.statusPolls.coerceAtMost(8)) {
                    transceive(out, input, 0xA3, byteArrayOf(1))
                    Thread.sleep(100)
                }
                transceive(out, input, 0xF3, byteArrayOf(1))
                Result.success(Unit)
            } finally {
                runCatching { socket.close() }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
