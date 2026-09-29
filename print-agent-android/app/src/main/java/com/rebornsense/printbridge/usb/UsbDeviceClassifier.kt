package com.rebornsense.printbridge.usb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
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

    /** True for attach events — includes USB printer class even when product name is generic. */
    fun shouldOfferUsbAccessOnAttach(context: android.content.Context?, device: UsbDevice): Boolean {
        if (isScannerOrReaderPeripheral(device)) return false
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        if (context != null && isUsbPrinterCandidate(context, device)) return true
        return (0 until device.interfaceCount).any { index ->
            device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER
        }
    }

    fun isScannerOrReaderPeripheral(device: UsbDevice): Boolean {
        return runCatching {
            if (device.deviceClass == UsbConstants.USB_CLASS_HID) return@runCatching true
            if (device.deviceClass == UsbConstants.USB_CLASS_HUB) return@runCatching true
            val classes = interfaceClasses(device)
            if (classes.any { it == 0x0B }) return@runCatching true
            if (device.vendorId in SERIAL_ADAPTER_VENDOR_IDS &&
                UsbConstants.USB_CLASS_PRINTER !in classes
            ) {
                return@runCatching true
            }
            classes.isNotEmpty() && classes.all { it in NON_PRINTER_INTERFACE_CLASSES }
        }.getOrDefault(true)
    }

    /**
     * Devices Bridge may ask USB permission for (receipt/kitchen/label printers only).
     * Scales are handled separately when reading weight — not on app launch.
     */
    fun isUsbPrinterCandidate(context: android.content.Context?, device: UsbDevice): Boolean {
        return runCatching {
            if (isScannerOrReaderPeripheral(device)) return@runCatching false
            if (context != null && PrinterPreferences.isRememberedUsbDevice(context, deviceKey(device))) {
                return@runCatching true
            }
            if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return@runCatching true
            if (hasPrinterInterface(device)) return@runCatching true
            if (device.vendorId in KNOWN_PRINTER_VENDOR_IDS && hasAnyBulkOut(device)) {
                return@runCatching true
            }
            // Gemini receipt printers often expose only a vendor-class bulk OUT interface.
            hasAnyBulkOut(device)
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

    private fun hasPrinterInterface(device: UsbDevice): Boolean {
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            if (iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER && hasBulkOut(iface)) return true
        }
        return false
    }

    private fun hasAnyBulkOut(device: UsbDevice): Boolean {
        for (index in 0 until device.interfaceCount) {
            val iface = runCatching { device.getInterface(index) }.getOrNull() ?: continue
            if (iface.interfaceClass in NON_PRINTER_INTERFACE_CLASSES) continue
            if (hasBulkOut(iface)) return true
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
}
