package com.rebornsense.printbridge.print

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import com.rebornsense.printbridge.BridgePermissions
import java.util.UUID

class BluetoothEscPosDriver : PrinterDriver {
    override val key: String = "bluetooth"

    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private val sockets = HashMap<String, CachedSocket>()

    private data class CachedSocket(val socket: BluetoothSocket, var lastUsedMs: Long)

    /**
     * Feed + full cut when the job has no GS V suffix (kitchen tickets end with ESC d only).
     * Matches Windows print-agent Get-BtCutTrailer — enough gap for the blade on clone printers.
     */
    private val btCutTrailer: ByteArray = byteArrayOf(
        0x1B, 0x64, 0x05,
        0x1D, 0x56, 0x00,
        0x0A, 0x0A,
    )

    @SuppressLint("MissingPermission")
    override fun discover(context: Context): List<PrinterEndpoint> {
        return runCatching {
            val adapter = bluetoothAdapter(context) ?: return@runCatching emptyList()
            if (!adapter.isEnabled) return@runCatching emptyList()
            adapter.bondedDevices.orEmpty().map { device ->
                val name = device.name?.takeIf { it.isNotBlank() } ?: device.address
                PrinterEndpoint(
                    id = "bt:${device.address}",
                    name = name,
                    connectionType = "bluetooth",
                    driverKey = key,
                    meta = mapOf("address" to device.address),
                )
            }
        }.getOrElse { emptyList() }
    }

    @SuppressLint("MissingPermission")
    override fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit> {
        val adapter = bluetoothAdapter(context) ?: return Result.failure(IllegalStateException("Bluetooth unavailable"))
        val address = endpoint.meta["address"] ?: return Result.failure(IllegalStateException("Missing BT address"))
        val device = adapter.bondedDevices?.firstOrNull { it.address == address }
            ?: return Result.failure(IllegalStateException("Bluetooth printer not paired"))
        return try {
            adapter.safeCancelDiscovery()
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
     * Pace SPP writes so raster/text is not truncated.
     * Mirror Windows Send-RawToPrinter: keep ESC d feeds in the body, drain, then send GS V (or trailer).
     * Do not strip ESC d from customer receipts — that was cutting before the tax footer cleared the blade.
     */
    private fun transmitBluetoothJob(socket: BluetoothSocket, data: ByteArray) {
        if (NiimbotPrintClient.isNiimbotPayload(data)) {
            writePaced(socket, data, chunkSize = 96, delayMs = 40)
            Thread.sleep(400)
            return
        }
        if (data.contentEquals(PrinterDriver.DRAWER_KICK)) {
            writePaced(socket, data, chunkSize = BT_CHUNK_SIZE, delayMs = BT_CHUNK_DELAY_MS)
            Thread.sleep(200)
            return
        }
        val (body, cutSuffix) = splitCutSuffix(data)
        if (body.isNotEmpty()) {
            writePaced(socket, body, chunkSize = BT_CHUNK_SIZE, delayMs = BT_CHUNK_DELAY_MS)
            // Short drain so the head can catch the buffer before GS V. A long sleep
            // here is the "prints a bit, stalls, then dumps the rest" burp.
            val drainMs = (80L + body.size / 80L).coerceAtMost(450L)
            Thread.sleep(drainMs)
        }
        val cutBytes = if (cutSuffix.isNotEmpty()) cutSuffix else btCutTrailer
        writePaced(socket, cutBytes, chunkSize = BT_CHUNK_SIZE, delayMs = BT_CHUNK_DELAY_MS)
        Thread.sleep(120)
    }

    /** Cut commands only, and only in the tail. Raster/QR bytes can contain 0x1D 0x56 by chance. */
    private fun splitCutSuffix(data: ByteArray): Pair<ByteArray, ByteArray> {
        if (data.size < 3) return data to byteArrayOf()
        val start = maxOf(0, data.size - 24)
        var i = data.size - 3
        while (i >= start) {
            if (isRealCutAt(data, i)) {
                return data.copyOfRange(0, i) to data.copyOfRange(i, data.size)
            }
            i--
        }
        return data to byteArrayOf()
    }

    private fun isRealCutAt(data: ByteArray, i: Int): Boolean {
        if (i < 0 || i + 1 >= data.size) return false
        if (data[i] == 0x1B.toByte() && (data[i + 1] == 0x69.toByte() || data[i + 1] == 0x6D.toByte())) {
            return true
        }
        if (i + 2 >= data.size) return false
        if (data[i] != 0x1D.toByte() || data[i + 1] != 0x56.toByte()) return false
        val mode = data[i + 2].toInt() and 0xFF
        return mode == 0x00 || mode == 0x01 || mode == 0x30 || mode == 0x31 || mode == 0x41 || mode == 0x42
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

    /** Drop cached SPP link after ACL disconnect so the next print opens a fresh socket. */
    fun releaseConnection(address: String) {
        closeSocket(address.trim())
    }

    /**
     * Opens a short SPP connection then closes (RebornPOS [warmupConnection] parity).
     * Does not keep a cached socket — first print still opens its own link.
     */
    @SuppressLint("MissingPermission")
    fun warmupConnection(context: Context, address: String): Boolean {
        if (!BridgePermissions.hasBluetoothPermissions(context)) {
            Log.d(TAG, "Skipping BT warmup — permissions not granted")
            return false
        }
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        val adapter = bluetoothAdapter(context) ?: return false
        if (!adapter.isEnabled) return false
        return runCatching {
            adapter.safeCancelDiscovery()
            val device = adapter.bondedDevices.orEmpty()
                .firstOrNull { it.address.equals(trimmed, ignoreCase = true) }
                ?: run {
                    Log.d(TAG, "Skipping BT warmup — $trimmed not paired")
                    return false
                }
            val socket = openBluetoothSocket(device)
            try {
                Log.d(TAG, "BT warmup OK for $trimmed")
                true
            } finally {
                runCatching { socket.close() }
            }
        }.onFailure { e ->
            Log.w(TAG, "Warmup failed for $trimmed: ${e.message}")
        }.getOrDefault(false)
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
        private const val TAG = "BluetoothEscPosDriver"
        private const val SOCKET_KEEP_MS = 12_000L
        private const val BT_CHUNK_SIZE = 512
        private const val BT_CHUNK_DELAY_MS = 12L
    }
}
