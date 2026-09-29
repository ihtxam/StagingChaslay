package com.rebornsense.printbridge.print

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager

class UsbEscPosDriver : PrinterDriver {
    override val key: String = "usb"

    override fun discover(context: Context): List<PrinterEndpoint> {
        val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return emptyList()
        // Only devices plugged in right now. Do not synthesize rows from
        // PrinterPreferences.rememberedUsbDevices after the cable is removed.
        val devices = usb.deviceList.values.toList()
        val rows = ArrayList<UsbPrinterRow>()
        for (device in devices) {
            val row = runCatching { toRow(context, usb, device) }.getOrNull() ?: continue
            rows += row
        }
        return dedupeUsbRows(rows).map { it.toEndpoint() }
    }

    /**
     * One physical printer is one row. A composite device with two bulk-OUT
     * interfaces is still one [UsbDevice] and must not be split. Extra
     * [UsbDevice] entries that share vendor/product (and serial, once permission
     * is granted) collapse to the same stable id. deviceName is not part of the
     * id — it changes between scans and was creating duplicate rows.
     */
    private fun toRow(context: Context, usb: UsbManager, device: UsbDevice): UsbPrinterRow? {
        if (!com.rebornsense.printbridge.usb.UsbDeviceClassifier.isUsbPrinterCandidate(context, device)) {
            return null
        }
        if (bulkOutEndpoint(device) == null) return null
        val permitted = usb.hasPermission(device)
        return UsbPrinterRow(
            vendorId = device.vendorId,
            productId = device.productId,
            serial = if (permitted) readSerial(device) else null,
            deviceName = device.deviceName,
            hasPermission = permitted,
            printerClass = hasPrinterClass(device),
            productName = safeProductName(usb, device),
        )
    }

    fun locate(context: Context, endpoint: PrinterEndpoint): UsbDevice? {
        val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return null
        return findDevice(usb, endpoint)
    }

    /** Product strings can stall the USB hub when permission is not granted. */
    private fun safeProductName(usb: UsbManager, device: UsbDevice): String? {
        if (!usb.hasPermission(device)) return null
        return runCatching { device.productName?.trim() }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    private fun readSerial(device: UsbDevice): String? {
        return runCatching { device.serialNumber?.trim() }.getOrNull()?.takeIf { it.isNotEmpty() }
    }

    override fun print(context: Context, endpoint: PrinterEndpoint, data: ByteArray): Result<Unit> {
        val usb = context.getSystemService(Context.USB_SERVICE) as UsbManager
        val device = findDevice(usb, endpoint) ?: return Result.failure(IllegalStateException("USB printer not found"))
        if (!usb.hasPermission(device)) {
            com.rebornsense.printbridge.usb.UsbHostPermissions.recordGrantedDevices(context)
            if (!usb.hasPermission(device)) {
                return Result.failure(
                    IllegalStateException(
                        "USB permission not granted for ${endpoint.name} — open Bridge Reborn and allow USB access",
                    ),
                )
            }
        }
        val connection = usb.openDevice(device) ?: return Result.failure(IllegalStateException("USB open failed"))
        return try {
            val (iface, outEp) = bulkOutEndpoint(device)
                ?: return Result.failure(IllegalStateException("No USB bulk OUT endpoint"))
            if (!connection.claimInterface(iface, true)) {
                return Result.failure(IllegalStateException("USB claim interface failed"))
            }
            try {
                sendChunks(connection, outEp, data)
                Result.success(Unit)
            } finally {
                connection.releaseInterface(iface)
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection.close()
        }
    }

    private fun findDevice(usb: UsbManager, endpoint: PrinterEndpoint): UsbDevice? {
        val identity = parseUsbIdentity(endpoint)
        val devices = usb.deviceList.values.filter { dev ->
            val vid = identity.vendorId
            val pid = identity.productId
            if (vid != null && pid != null) {
                dev.vendorId == vid && dev.productId == pid
            } else {
                dev.deviceName == endpoint.meta["deviceName"]
            }
        }
        if (devices.isEmpty()) return null
        val serial = identity.serial
        if (!serial.isNullOrEmpty()) {
            devices.firstOrNull { usb.hasPermission(it) && readSerial(it) == serial }?.let { return it }
        }
        val hinted = endpoint.meta["deviceName"]
        if (!hinted.isNullOrBlank()) {
            devices.firstOrNull { it.deviceName == hinted && bulkOutEndpoint(it) != null }?.let { return it }
        }
        return devices.firstOrNull { usb.hasPermission(it) && bulkOutEndpoint(it) != null }
            ?: devices.firstOrNull { bulkOutEndpoint(it) != null }
            ?: devices.first()
    }

    private fun parseUsbIdentity(endpoint: PrinterEndpoint): UsbIdentity {
        val metaVid = endpoint.meta["vendorId"]?.toIntOrNull()
        val metaPid = endpoint.meta["productId"]?.toIntOrNull()
        val metaSerial = endpoint.meta["serial"]?.trim()?.takeIf { it.isNotEmpty() }
        if (metaVid != null && metaPid != null) {
            return UsbIdentity(metaVid, metaPid, metaSerial)
        }
        if (!endpoint.id.startsWith("usb:")) return UsbIdentity(null, null, metaSerial)
        val parts = endpoint.id.removePrefix("usb:").split(":", limit = 3)
        val vid = parts.getOrNull(0)?.toIntOrNull()
        val pid = parts.getOrNull(1)?.toIntOrNull()
        val extra = parts.getOrNull(2)?.takeIf { it.isNotBlank() && !it.contains("/") }
        return UsbIdentity(vid, pid, metaSerial ?: extra)
    }

    private fun hasPrinterClass(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            if (iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER) return true
        }
        return false
    }

    /** First bulk OUT only — a second bulk OUT on the same device is not another printer. */
    private fun bulkOutEndpoint(device: UsbDevice): Pair<UsbInterface, UsbEndpoint>? {
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            for (e in 0 until intf.endpointCount) {
                val ep = intf.getEndpoint(e)
                if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.direction == UsbConstants.USB_DIR_OUT) {
                    return intf to ep
                }
            }
        }
        return null
    }

    private fun sendChunks(connection: UsbDeviceConnection, endpoint: UsbEndpoint, data: ByteArray) {
        var offset = 0
        val chunk = 4096
        while (offset < data.size) {
            val len = minOf(chunk, data.size - offset)
            val written = connection.bulkTransfer(endpoint, data, offset, len, 5000)
            if (written <= 0) throw IllegalStateException("USB bulk transfer failed at offset $offset")
            offset += written
        }
    }
}

internal data class UsbIdentity(
    val vendorId: Int?,
    val productId: Int?,
    val serial: String?,
)

internal data class UsbPrinterRow(
    val vendorId: Int,
    val productId: Int,
    val serial: String?,
    val deviceName: String,
    val hasPermission: Boolean,
    val printerClass: Boolean,
    val productName: String?,
) {
    val id: String
        get() {
            val serialPart = serial?.trim().orEmpty()
            return if (serialPart.isNotEmpty()) {
                "usb:$vendorId:$productId:$serialPart"
            } else {
                "usb:$vendorId:$productId"
            }
        }

    fun toEndpoint(): PrinterEndpoint {
        val label = productName?.takeIf { it.isNotBlank() }
            ?: "USB printer %04X:%04X".format(vendorId, productId)
        val meta = linkedMapOf(
            "deviceName" to deviceName,
            "vendorId" to vendorId.toString(),
            "productId" to productId.toString(),
        )
        val serialPart = serial?.trim().orEmpty()
        if (serialPart.isNotEmpty()) meta["serial"] = serialPart
        return PrinterEndpoint(
            id = id,
            name = label,
            connectionType = "usb",
            driverKey = "usb",
            meta = meta,
        )
    }
}

/** Same vendorId:productId (and serial, when already known) is one printer. */
internal fun dedupeUsbRows(rows: List<UsbPrinterRow>): List<UsbPrinterRow> {
    val grouped = LinkedHashMap<Pair<Int, Int>, MutableList<UsbPrinterRow>>()
    for (row in rows) {
        grouped.getOrPut(row.vendorId to row.productId) { mutableListOf() }.add(row)
    }
    val out = ArrayList<UsbPrinterRow>(grouped.size)
    for (group in grouped.values) {
        val serials = group.mapNotNull { it.serial?.trim()?.takeIf { serial -> serial.isNotEmpty() } }.distinct()
        if (serials.size >= 2) {
            for (serial in serials) {
                val subset = group.filter { it.serial?.trim() == serial }
                if (subset.isEmpty()) continue
                out += pickUsbRow(subset)
            }
        } else {
            val chosen = pickUsbRow(group)
            val onlySerial = serials.singleOrNull()
            out += if (chosen.serial.isNullOrBlank() && onlySerial != null) {
                chosen.copy(serial = onlySerial)
            } else {
                chosen
            }
        }
    }
    return out
}

private fun pickUsbRow(group: List<UsbPrinterRow>): UsbPrinterRow {
    return group.sortedWith(
        compareByDescending<UsbPrinterRow> { it.hasPermission }
            .thenByDescending { it.printerClass }
            .thenByDescending { !it.serial.isNullOrBlank() }
            .thenBy { it.deviceName },
    ).first()
}
