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
                writePaced(socket, data)
                sockets[address] = CachedSocket(socket, System.currentTimeMillis())
                Result.success(Unit)
            } catch (first: Exception) {
                closeSocket(address)
                val retry = openBluetoothSocket(device)
                try {
                    writePaced(retry, data)
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

    private fun writePaced(socket: BluetoothSocket, data: ByteArray) {
        val out = socket.outputStream
        var offset = 0
        val chunk = 96
        val delayMs = 40L
        while (offset < data.size) {
            val len = minOf(chunk, data.size - offset)
            out.write(data, offset, len)
            out.flush()
            offset += len
            if (offset < data.size) {
                Thread.sleep(delayMs)
            }
        }
        out.flush()
        val drainMs = (400L + data.size / 16L).coerceAtMost(4_000L)
        Thread.sleep(drainMs)
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
    }
}
