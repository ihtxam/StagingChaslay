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

    private fun transceive(out: OutputStream, input: InputStream?, type: Int, data: ByteArray, respOffset: Int = 1) {
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
                transceive(out, input, 0x21, byteArrayOf(density.coerceIn(1, 5).toByte()), 16)
                transceive(out, input, 0x23, byteArrayOf(1), 16)
                transceive(out, input, 0x01, byteArrayOf(1))
                transceive(out, input, 0x03, byteArrayOf(1))
                val dim = ByteBuffer.allocate(4).apply {
                    putShort(heightPx.toShort())
                    putShort(widthPx.toShort())
                }.array()
                transceive(out, input, 0x13, dim)
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
                    Thread.sleep(12)
                }
                transceive(out, input, 0xE3, byteArrayOf(1))
                Thread.sleep(300)
                repeat(20) {
                    transceive(out, input, 0xF3, byteArrayOf(1))
                    Thread.sleep(100)
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
