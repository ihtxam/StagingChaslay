package com.rebornsense.printbridge.scale

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import com.hoho.android.usbserial.driver.UsbSerialProber

/** Shared USB scale heuristics — parity with RebornPOS [com.chaslay.pos.scale.ScaleUsbMatcher]. */
object ScaleUsbMatcher {
    private const val ACLAS_VENDOR_ID = 6790
    private const val ACLAS_PRODUCT_ID = 29987
    private const val CH340_VENDOR_ID = 0x1A86
    private const val USB_COMM_SUBCLASS_ETHERNET = 6

    private val NON_SCALE_USB_KEYWORDS = listOf(
        "usb lan",
        "usb2.0 lan",
        "10/100",
        "10-100",
        "ethernet",
        "network adapter",
        "rndis",
        " ncm",
        " ecm",
        "asix",
        "ax881",
        "usb ethernet",
        "lan adapter",
    )

    private val SCALE_NAME_HINTS = listOf(
        "aclas",
        "os6",
        "ch340",
        "ch341",
        "usb serial",
        "usb-serial",
        "weighing",
        "weighing scale",
        "scale",
    )

    fun isLikelyScale(device: UsbDevice, isExcludedEscPosPrinter: (UsbDevice) -> Boolean): Boolean {
        if (isExcludedNonScaleDevice(device, isExcludedEscPosPrinter)) return false
        if (device.vendorId == ACLAS_VENDOR_ID && device.productId == ACLAS_PRODUCT_ID) return true
        val blob = deviceTextBlob(device)
        if (SCALE_NAME_HINTS.any { blob.contains(it) }) return true
        if (device.vendorId == CH340_VENDOR_ID && findSerialDriver(device) != null) return true
        return false
    }

    private fun isExcludedNonScaleDevice(
        device: UsbDevice,
        isExcludedEscPosPrinter: (UsbDevice) -> Boolean,
    ): Boolean {
        if (isExcludedEscPosPrinter(device)) return true
        val blob = deviceTextBlob(device)
        if (NON_SCALE_USB_KEYWORDS.any { keyword -> blob.contains(keyword) }) return true
        return hasUsbNetworkInterface(device)
    }

    private fun hasUsbNetworkInterface(device: UsbDevice): Boolean {
        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            if (usbInterface.interfaceClass == UsbConstants.USB_CLASS_WIRELESS_CONTROLLER) return true
            if (usbInterface.interfaceClass == UsbConstants.USB_CLASS_COMM &&
                usbInterface.interfaceSubclass == USB_COMM_SUBCLASS_ETHERNET
            ) {
                return true
            }
        }
        return false
    }

    private fun findSerialDriver(device: UsbDevice): com.hoho.android.usbserial.driver.UsbSerialDriver? {
        return UsbSerialProber.getDefaultProber().probeDevice(device)
    }

    private fun deviceTextBlob(device: UsbDevice): String =
        listOfNotNull(
            device.productName?.trim()?.takeIf { it.isNotEmpty() },
            device.manufacturerName?.trim()?.takeIf { it.isNotEmpty() },
        ).joinToString(" ").lowercase()
}
