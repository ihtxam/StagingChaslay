package com.rebornsense.printbridge.print

import android.content.Context

interface PrinterDriver {
    val key: String

    fun discover(context: Context): List<PrinterEndpoint>

    fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit>

    fun kickDrawer(context: Context, endpoint: PrinterEndpoint): Result<Unit> = print(context, endpoint, DRAWER_KICK)

    companion object {
        val DRAWER_KICK = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
    }
}
