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

    /** Same trailer as Windows print-agent Get-BtCutTrailer (feed + cut variants). */
    private val btCutTrailer: ByteArray = byteArrayOf(
        0x1B, 0x64, 0x0C, // ESC d 12 — extra feed for label/sticker gap
        0x1D, 0x56, 0x41, 0x30, // GS V 65 48 — feed 48 dots + full cut
        0x1D, 0x56, 0x00, // GS V 0 full cut
        0x1B, 0x69, // ESC i legacy cut
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
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
     * tickets are not truncated. After the body drains, send a dedicated cut trailer —
     * cheap BLE stacks often drop the cut when it is the last bytes of a large job.
     */
    private fun transmitBluetoothJob(socket: BluetoothSocket, data: ByteArray) {
        writePaced(socket, data, chunkSize = BT_CHUNK_SIZE, delayMs = BT_CHUNK_DELAY_MS)
        val drainMs = (800L + data.size / 8L).coerceAtMost(8_000L)
        Thread.sleep(drainMs)
        writePaced(socket, btCutTrailer, chunkSize = 32, delayMs = BT_CHUNK_DELAY_MS)
        Thread.sleep(500L)
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
