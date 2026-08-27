package com.rebornsense.printbridge.print

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import java.util.UUID

class BluetoothEscPosDriver : PrinterDriver {
    override val key: String = "bluetooth"

    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

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
            val socket = device.createRfcommSocketToServiceRecord(sppUuid)
            socket.connect()
            try {
                socket.outputStream.use { out ->
                    var offset = 0
                    val chunk = 4096
                    while (offset < data.size) {
                        val len = minOf(chunk, data.size - offset)
                        out.write(data, offset, len)
                        offset += len
                    }
                    out.flush()
                }
                Result.success(Unit)
            } finally {
                socket.close()
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun bluetoothAdapter(context: Context): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }
}
