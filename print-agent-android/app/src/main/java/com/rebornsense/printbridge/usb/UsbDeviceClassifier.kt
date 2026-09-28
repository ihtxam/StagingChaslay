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

    private val SCANNER_OR_READER_KEYWORDS = listOf(
        "barcode",
        "scanner",
        "scan ",
        " scan",
        "2d ",
        "1d ",
        "qr ",
        "qr-",
        "rfid",
        "mifare",
        "nfc",
        "card reader",
        "cardreader",
        "ccid",
        "smart card",
        "magnetic",
        "msr",
        "keyboard",
        "wedge",
        "hid",
        "handheld",
        "pistol",
        "symbol",
        "zebra",
        "honeywell",
        "datalogic",
        "newland",
        "urovo",
        "serial converter",
        "usb serial",
        "cp210",
        "ftdi",
        "silicon labs",
        "prolific",
        "ch340",
    )

    private val PRINTER_NAME_KEYWORDS = listOf(
        "print",
        "printer",
        "pos",
        "receipt",
        "thermal",
        "escpos",
        "xprinter",
        "rongta",
        "epson",
        "star ",
        "citizen",
        "bixolon",
        "niimbot",
        "label",
        "tspl",
    )

    private val KNOWN_PRINTER_VENDOR_IDS = setOf(
        0x0355, // Niimbot / Jingchen
        0x0416, // Winbond TSPL
        0x0FE6, // ICS Advent
        0x0483, // STM32 label stacks
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
        if (device.deviceClass == UsbConstants.USB_CLASS_HID) return true
        val blob = deviceNameBlob(device)
        if (SCANNER_OR_READER_KEYWORDS.any { blob.contains(it) }) return true
        // CH340 / Prolific serial adapters are scales/scanners unless explicitly a printer name.
        if (device.vendorId == 0x1A86 || device.vendorId == 0x067B) {
            if (PRINTER_NAME_KEYWORDS.any { blob.contains(it) }) return false
            if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return false
            return true
        }
        // CCID / smart-card class
        if ((0 until device.interfaceCount).any { device.getInterface(it).interfaceClass == 0x0B }) {
            return true
        }
        return false
    }

    /**
     * Devices Bridge may ask USB permission for (receipt/kitchen/label printers only).
     * Scales are handled separately when reading weight — not on app launch.
     */
    fun isUsbPrinterCandidate(context: android.content.Context?, device: UsbDevice): Boolean {
        if (isScannerOrReaderPeripheral(device)) return false
        if (context != null && PrinterPreferences.isRememberedUsbDevice(context, deviceKey(device))) {
            return true
        }
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        if (device.vendorId in KNOWN_PRINTER_VENDOR_IDS) return true
        val blob = deviceNameBlob(device)
        if (PRINTER_NAME_KEYWORDS.any { blob.contains(it) }) return true
        return (0 until device.interfaceCount).any { index ->
            val intf = device.getInterface(index)
            intf.interfaceClass == UsbConstants.USB_CLASS_PRINTER && hasBulkOut(intf)
        }
    }

    /** @deprecated Use [isUsbPrinterCandidate] for permission prompts. */
    fun isPrintOrScaleDevice(context: android.content.Context?, device: UsbDevice): Boolean {
        return isUsbPrinterCandidate(context, device)
    }

    private fun deviceNameBlob(device: UsbDevice): String {
        return listOfNotNull(
            device.productName?.trim(),
            device.manufacturerName?.trim(),
        ).joinToString(" ").lowercase()
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
