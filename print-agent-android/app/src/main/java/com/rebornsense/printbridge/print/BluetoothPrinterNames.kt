package com.rebornsense.printbridge.print

/** Two paired printers often share the same Bluetooth name — keep WebPOS rows distinct. */
internal fun disambiguateBluetoothPrinterNames(endpoints: List<PrinterEndpoint>): List<PrinterEndpoint> {
    val bluetooth = endpoints.filter { it.connectionType == "bluetooth" }
    if (bluetooth.size < 2) return endpoints
    val byName = bluetooth.groupBy { it.name.trim().lowercase() }
    val duplicateNames = byName.filter { (_, group) -> group.size > 1 }.keys
    if (duplicateNames.isEmpty()) return endpoints
    return endpoints.map { ep ->
        if (ep.connectionType != "bluetooth") return@map ep
        if (ep.name.trim().lowercase() !in duplicateNames) return@map ep
        val addr = ep.meta["address"]?.trim().orEmpty()
        if (addr.isEmpty()) return@map ep
        val tail = addr.replace(":", "").takeLast(4).uppercase()
        ep.copy(name = "${ep.name.trim()} · $tail")
    }
}
