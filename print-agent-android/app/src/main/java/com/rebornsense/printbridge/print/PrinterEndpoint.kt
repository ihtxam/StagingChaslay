package com.rebornsense.printbridge.print

data class PrinterEndpoint(
    val id: String,
    val name: String,
    val connectionType: String,
    val driverKey: String,
    val isDefault: Boolean = false,
    val meta: Map<String, String> = emptyMap(),
)
