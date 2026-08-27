package com.rebornsense.printbridge.print

import android.content.Context

class DriverRegistry(
    private val sunmi: SunmiInternalDriver = SunmiInternalDriver(),
    private val usb: UsbEscPosDriver = UsbEscPosDriver(),
    private val bluetooth: BluetoothEscPosDriver = BluetoothEscPosDriver(),
    private val network: NetworkRawDriver = NetworkRawDriver(),
) {
    private val drivers: List<PrinterDriver> = listOf(sunmi, usb, bluetooth, network)

    @Volatile
    private var cached: List<PrinterEndpoint> = emptyList()

    fun sunmiDriver(): SunmiInternalDriver = sunmi

    fun refresh(context: Context): List<PrinterEndpoint> {
        sunmi.bindIfNeeded(context.applicationContext)
        val found = drivers.flatMap { driver ->
            runCatching { driver.discover(context.applicationContext) }.getOrElse { emptyList() }
        }
        val defaultId = PrinterPreferences.getDefaultPrinterId(context)
        cached = found.map { ep ->
            ep.copy(isDefault = ep.id == defaultId || (defaultId == null && ep.isDefault))
        }.let { list ->
            if (list.none { it.isDefault } && list.isNotEmpty()) {
                list.mapIndexed { idx, ep -> ep.copy(isDefault = idx == 0) }
            } else list
        }
        return cached
    }

    fun list(): List<PrinterEndpoint> = cached

    fun findByName(name: String?): PrinterEndpoint? {
        val trimmed = name?.trim().orEmpty()
        if (trimmed.isBlank()) {
            return cached.firstOrNull { it.isDefault } ?: cached.firstOrNull()
        }
        return cached.firstOrNull { it.name.equals(trimmed, ignoreCase = true) }
            ?: cached.firstOrNull { it.name.contains(trimmed, ignoreCase = true) }
    }

    fun findById(id: String): PrinterEndpoint? = cached.firstOrNull { it.id == id }

    fun driverFor(endpoint: PrinterEndpoint): PrinterDriver? =
        drivers.firstOrNull { it.key == endpoint.driverKey }

    fun hasReadyPrinter(): Boolean = cached.isNotEmpty()
}
