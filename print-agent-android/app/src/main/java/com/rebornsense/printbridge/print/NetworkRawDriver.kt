package com.rebornsense.printbridge.print

import android.content.Context
import java.net.InetSocketAddress
import java.net.Socket

class NetworkRawDriver : PrinterDriver {
    override val key: String = "lan"

    override fun discover(context: Context): List<PrinterEndpoint> {
        return PrinterPreferences.getLanHosts(context).map { host ->
            PrinterEndpoint(
                id = "lan:$host",
                name = "LAN $host:9100",
                connectionType = "lan",
                driverKey = key,
                meta = mapOf("host" to host, "port" to "9100"),
            )
        }
    }

    override fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit> {
        val host = endpoint.meta["host"] ?: return Result.failure(IllegalStateException("Missing LAN host"))
        val port = endpoint.meta["port"]?.toIntOrNull() ?: 9100
        return try {
            Socket().use { socket ->
                socket.tcpNoDelay = true
                socket.connect(InetSocketAddress(host, port), 8000)
                socket.getOutputStream().use { out ->
                    out.write(data)
                    out.flush()
                }
                // Brief pause so the printer receives all bytes before the socket closes.
                Thread.sleep(200)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
