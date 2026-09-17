package com.rebornsense.printbridge.print

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import java.util.UUID

class BluetoothEscPosDriver : PrinterDriver {
    override val key: String = "bluetooth"

    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private val sockets = HashMap<String, CachedSocket>()

    private data class CachedSocket(val socket: BluetoothSocket, var lastUsedMs: Long)

    /** One full cut + short feed — cheap clones beep on every GS V / ESC m variant. */
    private val btCutTrailer: ByteArray = byteArrayOf(
        0x1B, 0x64, 0x05,
        0x1D, 0x56, 0x00,
        0x0A, 0x0A,
    )

    @SuppressLint("MissingPermission")
    override fun discover(context: Context): List<PrinterEndpoint> {
        val adapter = bluetoothAdapter(context) ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        return adapter.bondedDevices.orEmpty().map { device ->
            val name = device.name?.takeIf { it.isNotBlank() } ?: device.address
            PrinterEndpoint(
                id = "bt:${device.address}",
                name = name,
                connectionType = "bluetooth",
                driverKey = key,
                meta = mapOf("address" to device.address),
            )
        }
    }

    @SuppressLint("MissingPermission")
    override fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit> {
        val adapter = bluetoothAdapter(context) ?: return Result.failure(IllegalStateException("Bluetooth unavailable"))
        val address = endpoint.meta["address"] ?: return Result.failure(IllegalStateException("Missing BT address"))
        val device = adapter.bondedDevices?.firstOrNull { it.address == address }
            ?: return Result.failure(IllegalStateException("Bluetooth printer not paired"))
        return try {
            adapter.cancelDiscovery()
            evictStaleSockets()
            val socket = reuseOrOpen(address, device)
            try {
                transmitBluetoothJob(socket, data)
                sockets[address] = CachedSocket(socket, System.currentTimeMillis())
                Result.success(Unit)
            } catch (first: Exception) {
                closeSocket(address)
                val retry = openBluetoothSocket(device)
                try {
                    transmitBluetoothJob(retry, data)
                    sockets[address] = CachedSocket(retry, System.currentTimeMillis())
                    Result.success(Unit)
                } catch (second: Exception) {
                    runCatching { retry.close() }
                    Result.failure(second)
                }
            }
        } catch (e: Exception) {
            closeSocket(address)
            Result.failure(e)
        }
    }

    /**
     * Pace SPP writes like Windows print-agent (96-byte slices, 80ms gaps) so kitchen
     * tickets are not truncated. Strips any embedded feed/cut suffix from the payload
     * (kitchen tickets already include KITCHEN_TICKET_CUT) and sends one btCutTrailer
     * after the body drains — avoids 3–4 visible cuts on Chinese clones.
     */
    private fun transmitBluetoothJob(socket: BluetoothSocket, data: ByteArray) {
        if (NiimbotPrintClient.isNiimbotPayload(data)) {
            writePaced(socket, data, chunkSize = 96, delayMs = 40)
            Thread.sleep(400)
            return
        }
        val (body, _) = splitCutSuffix(data)
        if (body.isNotEmpty()) {
            writePaced(socket, body, chunkSize = BT_CHUNK_SIZE, delayMs = BT_CHUNK_DELAY_MS)
            val drainMs = (800L + body.size / 8L).coerceAtMost(8_000L)
            Thread.sleep(drainMs)
        }
        writePaced(socket, btCutTrailer, chunkSize = 32, delayMs = BT_CHUNK_DELAY_MS)
        Thread.sleep(500L)
    }

    /** Mirror Windows print-agent Split-CutSuffix — scan tail for GS V / ESC d. */
    private fun splitCutSuffix(data: ByteArray): Pair<ByteArray, ByteArray> {
        if (data.size < 4) return data to byteArrayOf()
        val start = maxOf(0, data.size - 96)
        var i = data.size - 1
        while (i >= start) {
            if (data[i] == 0x1D.toByte() && i + 1 < data.size && data[i + 1] == 0x56.toByte()) {
                val body = data.copyOfRange(0, i)
                val trail = data.copyOfRange(i, data.size)
                return body to trail
            }
            if (data[i] == 0x1B.toByte() && i + 1 < data.size && data[i + 1] == 0x64.toByte()) {
                val body = data.copyOfRange(0, i)
                val trail = data.copyOfRange(i, data.size)
                return body to trail
            }
            i--
        }
        return data to byteArrayOf()
    }

    private fun writePaced(
        socket: BluetoothSocket,
        data: ByteArray,
        chunkSize: Int,
        delayMs: Long,
    ) {
        if (data.isEmpty()) return
        val out = socket.outputStream
        var offset = 0
        while (offset < data.size) {
            val len = minOf(chunkSize, data.size - offset)
            out.write(data, offset, len)
            out.flush()
            offset += len
            if (offset < data.size && delayMs > 0L) {
                Thread.sleep(delayMs)
            }
        }
        out.flush()
        if (delayMs > 0L) {
            Thread.sleep(delayMs)
        }
    }

    private fun reuseOrOpen(address: String, device: BluetoothDevice): BluetoothSocket {
        val cached = sockets[address]
        if (cached != null && cached.socket.isConnected) {
            cached.lastUsedMs = System.currentTimeMillis()
            return cached.socket
        }
        closeSocket(address)
        return openBluetoothSocket(device)
    }

    private fun evictStaleSockets() {
        val now = System.currentTimeMillis()
        val stale = sockets.entries.filter { now - it.value.lastUsedMs > SOCKET_KEEP_MS }.map { it.key }
        stale.forEach { closeSocket(it) }
    }

    private fun closeSocket(address: String) {
        val cached = sockets.remove(address) ?: return
        runCatching { cached.socket.close() }
    }

    @SuppressLint("MissingPermission")
    private fun openBluetoothSocket(device: BluetoothDevice): BluetoothSocket {
        val errors = mutableListOf<Throwable>()
        try {
            val socket = device.createRfcommSocketToServiceRecord(sppUuid)
            socket.connect()
            return socket
        } catch (e: Exception) {
            errors += e
        }
        try {
            val socket = device.createInsecureRfcommSocketToServiceRecord(sppUuid)
            socket.connect()
            return socket
        } catch (e: Exception) {
            errors += e
        }
        try {
            val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
            val socket = method.invoke(device, 1) as BluetoothSocket
            socket.connect()
            return socket
        } catch (e: Exception) {
            errors += e
        }
        val message = errors.lastOrNull()?.message ?: "Bluetooth connect failed"
        throw IllegalStateException(message)
    }

    private fun bluetoothAdapter(context: Context): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }

    companion object {
        private const val SOCKET_KEEP_MS = 12_000L
        private const val BT_CHUNK_SIZE = 96
        private const val BT_CHUNK_DELAY_MS = 80L
    }
}
