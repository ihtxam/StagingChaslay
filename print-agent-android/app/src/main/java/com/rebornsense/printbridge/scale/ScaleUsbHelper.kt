package com.rebornsense.printbridge.scale

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager

data class ScaleUsbDevice(
    val stableAddress: String,
    val vendorId: Int,
    val productId: Int,
    val displayName: String,
    val hasPermission: Boolean
)

object ScaleUsbHelper {
    private const val USB_PREFIX = "usb:"

    fun stableAddress(device: UsbDevice): String {
        val serial = runCatching { device.serialNumber?.trim() }.getOrNull()?.takeIf { it.isNotEmpty() }
        return if (serial != null) {
            "${USB_PREFIX}${device.vendorId}:${device.productId}:$serial"
        } else {
            "${USB_PREFIX}${device.vendorId}:${device.productId}"
        }
    }

    fun normalizeStoredAddress(context: Context, address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) return trimmed
        resolveDevice(context, trimmed)?.let { return stableAddress(it) }
        return trimmed
    }

    fun listDevices(context: Context): List<ScaleUsbDevice> {
        val manager = usbManager(context) ?: return emptyList()
        return manager.deviceList.values
            .filter { isLikelyScale(it) }
            .map { device ->
                ScaleUsbDevice(
                    stableAddress = stableAddress(device),
                    vendorId = device.vendorId,
                    productId = device.productId,
                    displayName = buildDisplayName(device),
                    hasPermission = manager.hasPermission(device)
                )
            }
    }

    fun resolveDevice(context: Context, address: String): UsbDevice? {
        val manager = usbManager(context) ?: return null
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) {
            val parsed = parseStableAddress(trimmed) ?: return null
            val (vid, pid, serial) = parsed
            return manager.deviceList.values.firstOrNull { dev ->
                dev.vendorId == vid && dev.productId == pid &&
                    (serial == null || dev.serialNumber == serial)
            }
        }
        if (trimmed.startsWith("/dev/bus/usb")) {
            return manager.deviceList.values.firstOrNull { it.deviceName == trimmed }
        }
        return null
    }

    private fun parseStableAddress(address: String): Triple<Int, Int, String?>? {
        if (!address.startsWith(USB_PREFIX)) return null
        val body = address.removePrefix(USB_PREFIX)
        val parts = body.split(":")
        val vid = parts.getOrNull(0)?.toIntOrNull() ?: return null
        val pid = parts.getOrNull(1)?.toIntOrNull() ?: return null
        val serial = parts.drop(2).joinToString(":").takeIf { it.isNotEmpty() }
        return Triple(vid, pid, serial)
    }

    private fun isLikelyScale(device: UsbDevice): Boolean {
        if (device.vendorId == ACLAS_VENDOR_ID && device.productId == ACLAS_PRODUCT_ID) return true
        if (device.vendorId == QINHENG_VENDOR_ID) return true
        return (0 until device.interfaceCount).any { index ->
            val usbInterface = device.getInterface(index)
            usbInterface.interfaceClass == UsbConstants.USB_CLASS_CDC_DATA ||
                usbInterface.interfaceClass == UsbConstants.USB_CLASS_COMM
        }
    }

    private fun buildDisplayName(device: UsbDevice): String {
        val label = listOfNotNull(
            device.productName?.trim()?.takeIf { it.isNotEmpty() },
            device.manufacturerName?.trim()?.takeIf { it.isNotEmpty() }
        ).distinct().joinToString(" ").ifBlank { "USB scale" }
        return "$label (${device.vendorId}:${device.productId})"
    }

    private fun usbManager(context: Context): UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

    private const val ACLAS_VENDOR_ID = 6790
    private const val ACLAS_PRODUCT_ID = 29987
    private const val QINHENG_VENDOR_ID = 0x1A86
}
