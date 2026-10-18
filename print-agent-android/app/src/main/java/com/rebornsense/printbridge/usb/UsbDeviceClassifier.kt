package com.rebornsense.printbridge.usb

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * USB classification for Bridge Reborn on multi-peripheral POS hardware (e.g. Nebullus Gemini:
 * RFID reader, barcode scanner, receipt printer on the same hub).
 *
 * Barcode wedges and RFID readers often expose CDC/CH340 bulk interfaces — they must not trigger
 * Bridge USB permission dialogs or appear as ESC/POS printers.
 */
object UsbDeviceClassifier {

    /** Serial/scanner adapters. Never read USB string descriptors to classify these. */
    private val SERIAL_ADAPTER_VENDOR_IDS = setOf(
        0x1A86, // QinHeng CH340
        0x067B, // Prolific
        0x10C4, // Silicon Labs CP210x
        0x0403, // FTDI
        0x05E0, // Symbol / Zebra
        0x0C2E, // Honeywell
        0x05F9, // Datalogic
        0x0536, // Honeywell/HHP
    )

    private val KNOWN_PRINTER_VENDOR_IDS = setOf(
        0x0355, // Niimbot / Jingchen
        0x0416, // Winbond TSPL
        0x0418, // Common Gemini / 80mm USB receipt
        0x04B8, // Epson
        0x0519, // Star Micronics
        0x0FE6, // ICS Advent
        0x0483, // STM32 label / receipt stacks
        0x1504, // Bixolon
        0x0DD4, // Custom Engineering
        0x154F, // SNBC
        0x28E9, // GigaDevice receipt clones
        0x6868, // Zjiang
    )

    private val NON_PRINTER_INTERFACE_CLASSES = setOf(
        UsbConstants.USB_CLASS_HID,
        UsbConstants.USB_CLASS_HUB,
        UsbConstants.USB_CLASS_AUDIO,
        UsbConstants.USB_CLASS_MASS_STORAGE,
        UsbConstants.USB_CLASS_VIDEO,
        UsbConstants.USB_CLASS_CDC_DATA,
        UsbConstants.USB_CLASS_COMM,
        0x0B, // CCID smart card
    )

    /** Realtek. USB 10/100 LAN (0x0BDA:0x8152) is an ethernet dongle, not a printer or scale. */
    private const val REALTEK_VENDOR_ID = 0x0BDA

    /** CDC-ECM, CDC-EEM, CDC-NCM, CDC-MBIM. */
    private val CDC_NETWORK_SUBCLASSES = setOf(0x06, 0x0C, 0x0D, 0x0E)

    /** Wireless Controller / RNDIS (class 0xE0, subclass 0x01, protocol 0x03). */
    private const val USB_CLASS_WIRELESS_CONTROLLER = 0xE0

    /**
     * Product strings already cached by the host. "lan" is a token so names like
     * "island" are left alone; "USB 10/100 LAN" still matches.
     */
    private val NETWORK_PRODUCT_NAME = Regex(
        """ethernet|802\.11|wi-?fi|rndis|usb\s*network|(^|[^a-z0-9])lan([^a-z0-9]|$)""",
        RegexOption.IGNORE_CASE,
    )

    /** True for attach events — includes USB printer class even when product name is generic. */
    fun shouldOfferUsbAccessOnAttach(context: android.content.Context?, device: UsbDevice): Boolean {
        if (isSunmiInternalUsbShadow(context, device)) return false
        if (isUsbNetworkAdapter(context, device)) return false
        if (isScannerOrReaderPeripheral(device)) return false
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        if (context != null && isUsbPrinterCandidate(context, device)) return true
        if (isOtgEscPosBulkDevice(device)) return true
        return (0 until device.interfaceCount).any { index ->
            device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER
        }
    }

    /**
     * USB Type-B OTG receipt printers (CDC/CH340/vendor bulk) that do not declare USB printer class.
     * Used for permission prompts and discovery — not for HID keyboard wedges.
     */
    fun isOtgEscPosBulkDevice(device: UsbDevice): Boolean {
        return runCatching {
            if (hasPrinterClass(device)) return@runCatching true
            if (device.deviceClass == UsbConstants.USB_CLASS_HID) return@runCatching false
            if (device.deviceClass == UsbConstants.USB_CLASS_HUB) return@runCatching false
            val classes = interfaceClasses(device)
            if (classes.any { it == 0x0B }) return@runCatching false
            if (classes.any { it == UsbConstants.USB_CLASS_HID }) return@runCatching false
            if (isUsbNetworkAdapter(null, device)) return@runCatching false
            hasOtgBulkOut(device)
        }.getOrDefault(false)
    }

    /**
     * USB ethernet, RNDIS, CDC-ECM, and CDC-NCM adapters, plus Realtek (0x0BDA).
     * A device that actually exposes [UsbConstants.USB_CLASS_PRINTER] is not excluded.
     * Product name is read only when USB permission is already granted.
     */
    fun isUsbNetworkAdapter(context: Context?, device: UsbDevice): Boolean {
        if (hasPrinterClass(device)) return false
        if (device.vendorId == REALTEK_VENDOR_ID) return true
        if (hasUsbNetworkInterface(device)) return true
        val name = safeProductName(context, device) ?: return false
        return looksLikeNetworkProductName(name)
    }

    fun looksLikeNetworkProductName(productName: String): Boolean {
        return NETWORK_PRODUCT_NAME.containsMatchIn(productName)
    }

    fun isScannerOrReaderPeripheral(device: UsbDevice): Boolean {
        return runCatching {
            if (hasPrinterClass(device)) return@runCatching false
            if (device.deviceClass == UsbConstants.USB_CLASS_HID) return@runCatching true
            if (device.deviceClass == UsbConstants.USB_CLASS_HUB) return@runCatching true
            val classes = interfaceClasses(device)
            if (classes.any { it == 0x0B }) return@runCatching true
            // CH340/CP210x serial chips are used by both barcode wedges and cheap USB receipt
            // printers — do not blanket-ignore the vendor; fall through to interface checks.
            if (classes.isNotEmpty() && classes.all { it in NON_PRINTER_INTERFACE_CLASSES }) {
                if (UsbConstants.USB_CLASS_HID in classes) return@runCatching true
                // CH340/CP210x receipt printers are often CDC-only; classify in [isUsbPrinterCandidate].
                if (device.vendorId in SERIAL_ADAPTER_VENDOR_IDS) return@runCatching false
                return@runCatching true
            }
            false
        }.getOrDefault(false)
    }

    /**
     * Devices Bridge may ask USB permission for (receipt/kitchen/label printers only).
     * Scales are handled separately when reading weight — not on app launch.
     */
    /**
     * Sunmi D3/D2 expose the built-in thermal as a USB gadget (often labeled AX8772B).
     * Printing must use [com.rebornsense.printbridge.print.SunmiInternalDriver], not USB ESC/POS.
     */
    fun isSunmiInternalUsbShadow(context: Context?, device: UsbDevice): Boolean {
        if (!isSunmiHardware()) return false
        val blob = deviceIdentityBlob(context, device)
        if (blob.isNotEmpty() && SUNMI_INTERNAL_USB_NAME.containsMatchIn(blob)) return true
        if (hasPrinterClass(device) && !blob.contains("gd32")) return false
        // Vendor-class bulk OUT only — typical for the internal bridge, not a Type-A receipt printer.
        if (!hasPrinterClass(device) && hasAnyBulkOut(device) && !hasPrinterInterface(device)) {
            val classes = interfaceClasses(device)
            if (classes.isNotEmpty() && classes.all { it == UsbConstants.USB_CLASS_VENDOR_SPEC }) {
                return true
            }
        }
        return false
    }

    fun isUsbPrinterCandidate(context: android.content.Context?, device: UsbDevice): Boolean {
        return runCatching {
            if (isSunmiInternalUsbShadow(context, device)) return@runCatching false
            // Before the remembered-printer shortcut: a Realtek dongle must not stay listed.
            if (isUsbNetworkAdapter(context, device)) return@runCatching false
            if (isScannerOrReaderPeripheral(device)) return@runCatching false
            if (context != null && PrinterPreferences.isRememberedUsbDevice(context, deviceKey(device))) {
                return@runCatching true
            }
            if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return@runCatching true
            if (hasPrinterInterface(device)) return@runCatching true
            if (device.vendorId in KNOWN_PRINTER_VENDOR_IDS && hasEscPosBulkOut(device)) {
                return@runCatching true
            }
            if (device.vendorId in SERIAL_ADAPTER_VENDOR_IDS) {
                val classes = interfaceClasses(device)
                if (UsbConstants.USB_CLASS_HID !in classes && hasEscPosBulkOut(device, allowCdcData = true)) {
                    return@runCatching true
                }
            }
            if (isOtgEscPosBulkDevice(device)) return@runCatching true
            // Gemini receipt printers often expose only a vendor-class bulk OUT interface.
            hasEscPosBulkOut(device)
        }.getOrDefault(false)
    }

    /** @deprecated Use [isUsbPrinterCandidate] for permission prompts. */
    fun isPrintOrScaleDevice(context: android.content.Context?, device: UsbDevice): Boolean {
        return isUsbPrinterCandidate(context, device)
    }

    private fun interfaceClasses(device: UsbDevice): List<Int> {
        val classes = ArrayList<Int>(device.interfaceCount)
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            classes.add(iface.interfaceClass)
        }
        return classes
    }

    private fun safeProductName(context: Context?, device: UsbDevice): String? {
        if (context == null) return null
        val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return null
        if (!usb.hasPermission(device)) return null
        return runCatching { device.productName?.trim() }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    private fun hasUsbNetworkInterface(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_COMM &&
            device.deviceSubclass in CDC_NETWORK_SUBCLASSES
        ) {
            return true
        }
        if (device.deviceClass == USB_CLASS_WIRELESS_CONTROLLER &&
            device.deviceSubclass == 0x01 &&
            device.deviceProtocol == 0x03
        ) {
            return true
        }
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            val cls = iface.interfaceClass
            val sub = iface.interfaceSubclass
            val proto = iface.interfaceProtocol
            if (cls == UsbConstants.USB_CLASS_COMM && sub in CDC_NETWORK_SUBCLASSES) return true
            // Microsoft RNDIS: CDC ACM with vendor protocol.
            if (cls == UsbConstants.USB_CLASS_COMM && sub == 0x02 && proto == 0xFF) return true
            if (cls == USB_CLASS_WIRELESS_CONTROLLER && sub == 0x01 && proto == 0x03) return true
        }
        return false
    }

    private fun hasPrinterClass(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            if (iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER) return true
        }
        return false
    }

    private fun hasPrinterInterface(device: UsbDevice): Boolean {
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            if (iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER && hasBulkOut(iface)) return true
        }
        return false
    }

    private fun hasAnyBulkOut(device: UsbDevice): Boolean {
        return hasEscPosBulkOut(device, allowCdcData = false)
    }

    /**
     * Bulk OUT on printer/vendor interfaces, and on CDC data when the device is a known
     * receipt printer or was granted before (Gemini 0418, CH340 thermal, etc.).
     */
    private fun hasOtgBulkOut(device: UsbDevice): Boolean {
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            val cls = iface.interfaceClass
            if (cls == UsbConstants.USB_CLASS_HUB) continue
            if (cls == UsbConstants.USB_CLASS_HID) continue
            if (hasBulkOut(iface)) return true
        }
        return false
    }

    private fun hasEscPosBulkOut(device: UsbDevice, allowCdcData: Boolean = true): Boolean {
        val allowCdc = allowCdcData &&
            (
                device.vendorId in KNOWN_PRINTER_VENDOR_IDS ||
                    hasPrinterClass(device) ||
                    hasPrinterInterface(device)
            )
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            val cls = iface.interfaceClass
            when {
                cls == UsbConstants.USB_CLASS_PRINTER -> if (hasBulkOut(iface)) return true
                cls == UsbConstants.USB_CLASS_VENDOR_SPEC -> if (hasBulkOut(iface)) return true
                allowCdc && cls == UsbConstants.USB_CLASS_CDC_DATA -> if (hasBulkOut(iface)) return true
                cls in NON_PRINTER_INTERFACE_CLASSES -> continue
                hasBulkOut(iface) -> return true
            }
        }
        return false
    }

    private fun hasBulkOut(intf: android.hardware.usb.UsbInterface): Boolean {
        for (e in 0 until intf.endpointCount) {
            val ep = intf.getEndpoint(e)
            if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                ep.direction == UsbConstants.USB_DIR_OUT
            ) {
                return true
            }
        }
        return false
    }

    private fun deviceKey(device: UsbDevice): String = "${device.vendorId}:${device.productId}"

    private fun isSunmiHardware(): Boolean {
        return Build.MANUFACTURER.orEmpty().contains("SUNMI", ignoreCase = true)
    }

    private val SUNMI_INTERNAL_USB_NAME = Regex(
        """ax8772|gd32|usb[_\s-]*printer\s*port|built-?in|internal\s*print|sunmi\s*print""",
        RegexOption.IGNORE_CASE,
    )

    private fun deviceIdentityBlob(context: Context?, device: UsbDevice): String {
        val parts = mutableListOf<String>()
        runCatching { device.deviceName?.trim() }.getOrNull()?.let { parts += it }
        runCatching { device.productName?.trim() }.getOrNull()?.let { parts += it }
        safeProductName(context, device)?.let { parts += it }
        return parts.joinToString(" ").lowercase()
    }
}
