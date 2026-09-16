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
 * Niimbot label protocol (K3 / B21 / D11). Not ESC/POS.
 * Ported from https://github.com/AndBondStyle/niimprint
 *
 * Every command except the raster rows is a request/response pair
 * (https://printers.niim.blue/interfacing/proto/), and PrintEnd must be
 * repeated until the printer answers 0xf4 with 01 — "print finished
 * (accepted)". Bluetooth SPP is the transport that can do that.
 */
object NiimbotPrintClient {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    fun isNiimbotPayload(data: ByteArray): Boolean =
        data.size >= 2 && data[0] == 0x55.toByte() && data[1] == 0x55.toByte()

    fun isNiimbotPrinterName(name: String?): Boolean {
        val n = name.orEmpty().lowercase()
        return Regex("""niimbot|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b""").containsMatchIn(n)
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
                val packets = buildAllPackets(bitmap, widthPx, heightPx, density)
                val payload = packets.reduce { acc, bytes -> acc + bytes }
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

    /**
     * Waits for one framed reply carrying [expected]. Bluetooth classic
     * fragments packets, so the buffer is rescanned after every read.
     */
    private fun readReply(input: InputStream, expected: Int, timeoutMs: Long): ByteArray? {
        val deadline = System.currentTimeMillis() + timeoutMs
        val buf = ByteArray(512)
        var used = 0
        while (System.currentTimeMillis() < deadline) {
            val ready = try {
                input.available()
            } catch (_: Exception) {
                return null
            }
            if (ready <= 0) {
                Thread.sleep(20)
                continue
            }
            val read = try {
                input.read(buf, used, minOf(ready, buf.size - used))
            } catch (_: Exception) {
                return null
            }
            if (read <= 0) return null
            used += read
            var i = 0
            while (i + 6 < used) {
                if (buf[i] != 0x55.toByte() || buf[i + 1] != 0x55.toByte()) {
                    i++
                    continue
                }
                val end = i + 4 + (buf[i + 3].toInt() and 0xff) + 3
                if (end > used) break
                if ((buf[i + 2].toInt() and 0xff) == expected) return buf.copyOfRange(i, end)
                i = end
            }
            if (used >= buf.size) used = 0
        }
        return null
    }

    private fun acked(reply: ByteArray?): Boolean =
        reply != null && reply.size >= 8 && reply[4] == 1.toByte()

    private fun transceive(
        out: OutputStream,
        input: InputStream?,
        type: Int,
        data: ByteArray,
        respOffset: Int = 1,
    ): ByteArray? {
        out.write(packet(type, data))
        out.flush()
        if (input == null) {
            Thread.sleep(60)
            return null
        }
        return readReply(input, type + respOffset, 700)
    }

    private fun buildAllPackets(bitmap: ByteArray, widthPx: Int, heightPx: Int, density: Int): List<ByteArray> {
        val d = density.coerceIn(1, 5)
        val packets = mutableListOf<ByteArray>()
        packets += packet(0x21, byteArrayOf(d.toByte()))
        packets += packet(0x23, byteArrayOf(1))
        packets += packet(0x01, byteArrayOf(1))
        packets += packet(0x03, byteArrayOf(1))
        val dim = ByteBuffer.allocate(4).apply {
            putShort(heightPx.toShort())
            putShort(widthPx.toShort())
        }.array()
        packets += packet(0x13, dim)
        val rowBytes = ceil(widthPx / 8.0).toInt()
        for (y in 0 until heightPx) {
            val rowStart = y * rowBytes
            val line = bitmap.copyOfRange(rowStart, rowStart + rowBytes)
            val header = ByteBuffer.allocate(6).apply {
                putShort(y.toShort())
                put(0)
                put(0)
                put(0)
                put(1)
            }.array()
            packets += packet(0x85, header + line)
        }
        packets += packet(0xE3, byteArrayOf(1))
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
        return try {
            adapter.cancelDiscovery()
            val socket = device.createInsecureRfcommSocketToServiceRecord(sppUuid)
            socket.connect()
            try {
                val out = socket.outputStream
                val input = socket.inputStream
                val density5 = density.coerceIn(1, 5).toByte()
                if (!acked(transceive(out, input, 0x21, byteArrayOf(density5), 16))) {
                    throw IllegalStateException("Printer did not answer SetDensity — not speaking Niimbot on this connection")
                }
                transceive(out, input, 0x23, byteArrayOf(1), 16)
                transceive(out, input, 0x01, byteArrayOf(1))
                transceive(out, input, 0x03, byteArrayOf(1))
                val dim = ByteBuffer.allocate(4).apply {
                    putShort(heightPx.toShort())
                    putShort(widthPx.toShort())
                }.array()
                if (!acked(transceive(out, input, 0x13, dim))) {
                    throw IllegalStateException("Printer rejected the page size ${widthPx}x$heightPx")
                }
                val rowBytes = ceil(widthPx / 8.0).toInt()
                for (y in 0 until heightPx) {
                    val rowStart = y * rowBytes
                    val line = bitmap.copyOfRange(rowStart, rowStart + rowBytes)
                    val header = ByteBuffer.allocate(6).apply {
                        putShort(y.toShort())
                        put(0); put(0); put(0); put(1)
                    }.array()
                    out.write(packet(0x85, header + line))
                    out.flush()
                    Thread.sleep(8)
                }
                transceive(out, input, 0xE3, byteArrayOf(1))
                var committed = false
                for (attempt in 0 until 12) {
                    if (acked(transceive(out, input, 0xF3, byteArrayOf(1)))) {
                        committed = true
                        break
                    }
                    Thread.sleep(80)
                }
                if (!committed) {
                    throw IllegalStateException("Printer never confirmed the label finished printing")
                }
                Result.success(Unit)
            } finally {
                runCatching { socket.close() }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
