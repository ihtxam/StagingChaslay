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
        val devices = runCatching { usb.deviceList.values.toList() }.getOrElse { return emptyList() }
        return devices.mapNotNull { device ->
            runCatching {
                if (!com.rebornsense.printbridge.usb.UsbDeviceClassifier.isUsbPrinterCandidate(context, device)) {
                    return@runCatching null
                }
                if (bulkOutEndpoint(device) == null) return@runCatching null
                val name = safeProductName(usb, device)
                    ?: "USB printer %04X:%04X".format(device.vendorId, device.productId)
                PrinterEndpoint(
                id = "usb:${device.vendorId}:${device.productId}:${device.deviceName}",
                name = name,
                connectionType = "usb",
                driverKey = key,
                meta = mapOf(
                    "deviceName" to device.deviceName,
                    "vendorId" to device.vendorId.toString(),
                    "productId" to device.productId.toString(),
                ),
            )
            }.getOrNull()
        }
    }

    /** Product strings can stall the USB hub when permission is not granted. */
    private fun safeProductName(usb: UsbManager, device: UsbDevice): String? {
        if (!usb.hasPermission(device)) return null
        return runCatching { device.productName?.trim() }.getOrNull()?.takeIf { it.isNotBlank() }
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
        val deviceName = endpoint.meta["deviceName"]
        return usb.deviceList.values.firstOrNull { dev ->
            dev.deviceName == deviceName ||
                endpoint.id == "usb:${dev.vendorId}:${dev.productId}:${dev.deviceName}"
        }
    }

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
