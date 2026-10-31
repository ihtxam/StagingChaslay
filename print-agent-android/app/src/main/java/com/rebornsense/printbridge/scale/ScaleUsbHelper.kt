package com.rebornsense.printbridge.scale

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.rebornsense.printbridge.usb.UsbDeviceClassifier

/** vid:pid permission key — never includes serial (serial needs USB permission). */

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

    fun permissionKey(address: String): String {
        parseStableAddress(normalizeStoredAddressWithoutContext(address))?.let { (vid, pid, _) ->
            return "$USB_PREFIX$vid:$pid"
        }
        return address.trim()
    }

    private fun normalizeStoredAddressWithoutContext(address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) return trimmed
        return trimmed
    }

    fun listDevices(context: Context): List<ScaleUsbDevice> {
        val manager = usbManager(context) ?: return emptyList()
        return manager.deviceList.values
            .filter { device ->
                !UsbDeviceClassifier.isUsbNetworkAdapter(context, device) && isLikelyScale(context, device)
            }
            .map { device ->
                val permitted = manager.hasPermission(device)
                ScaleUsbDevice(
                    stableAddress = stableAddress(device),
                    vendorId = device.vendorId,
                    productId = device.productId,
                    displayName = buildDisplayName(device, permitted),
                    hasPermission = permitted
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

    private fun isLikelyScale(context: Context, device: UsbDevice): Boolean {
        return ScaleUsbMatcher.isLikelyScale(device) {
            UsbDeviceClassifier.isUsbPrinterCandidate(context, it)
        }
    }

    private fun buildDisplayName(device: UsbDevice, hasPermission: Boolean): String {
        val product = if (hasPermission) {
            runCatching { device.productName?.trim() }.getOrNull()?.takeIf { it.isNotEmpty() }
        } else {
            null
        }
        val manufacturer = if (hasPermission) {
            runCatching { device.manufacturerName?.trim() }.getOrNull()?.takeIf { it.isNotEmpty() }
        } else {
            null
        }
        val label = listOfNotNull(product, manufacturer).distinct().joinToString(" ").ifBlank { "USB scale" }
        return "$label (${device.vendorId}:${device.productId})"
    }

    private fun usbManager(context: Context): UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

}
