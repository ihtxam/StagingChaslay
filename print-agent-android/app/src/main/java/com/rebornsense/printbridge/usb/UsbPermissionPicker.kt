package com.rebornsense.printbridge.usb

import android.content.Context
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * On multi-USB POS hubs (Nebullus: RFID + scanner + receipt printer), more than one device
 * may lack permission. Pick the most likely receipt printer instead of skipping the prompt.
 */
object UsbPermissionPicker {
    fun pickBest(context: Context, devices: Collection<UsbDevice>): UsbDevice? {
        if (devices.isEmpty()) return null
        if (devices.size == 1) return devices.first()
        val app = context.applicationContext
        return devices
            .map { device -> device to score(app, device) }
            .filter { (_, score) -> score > 0 }
            .maxByOrNull { (_, score) -> score }
            ?.first
            ?: devices.minByOrNull { it.deviceId }
    }

    fun score(context: Context, device: UsbDevice): Int {
        var points = 0
        if (UsbDeviceClassifier.isScannerOrReaderPeripheral(device)) {
            points -= 400
        }
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) {
            points += 250
        }
        if (UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(context, device)) {
            points += 120
        }
        if (UsbDeviceClassifier.isOtgEscPosBulkDevice(device)) {
            points += 80
        }
        if (isOnlyNonHubPeripheralOnBus(context, device)) {
            points += 100
        }
        val key = "${device.vendorId}:${device.productId}"
        if (PrinterPreferences.isRememberedUsbDevice(context, key)) {
            points += 60
        }
        return points
    }

    /** External OTG cable: often the only non-hub device on the bus. */
    private fun isOnlyNonHubPeripheralOnBus(context: Context, device: UsbDevice): Boolean {
        val usb = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return false
        val peers = usb.deviceList.values.filter { peer ->
            peer.deviceId != device.deviceId &&
                peer.deviceClass != UsbConstants.USB_CLASS_HUB &&
                !UsbDeviceClassifier.isScannerOrReaderPeripheral(peer)
        }
        return peers.isEmpty()
    }
}
