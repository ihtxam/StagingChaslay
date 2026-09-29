package com.rebornsense.printbridge.usb

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.MainActivity

/**
 * Launched by the system when a filtered USB printer is plugged in (same pattern as Reborn POS).
 * Shows the platform USB allow dialog from a visible activity — never from a broadcast receiver.
 */
class UsbPrinterAttachActivity : AppCompatActivity() {
    private var usbPromptIssued = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            finish()
            return
        }
    }

    override fun onResume() {
        super.onResume()
        val device = intent?.usbDeviceExtra()
        if (device == null || !UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(applicationContext, device)) {
            finish()
            return
        }
        val usb = getSystemService(UsbManager::class.java) ?: run {
            finish()
            return
        }
        UsbHostPermissions.recordGrantedDevices(this)
        if (usb.hasPermission(device)) {
            onUsbAccessReady()
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            return
        }
        if (!usbPromptIssued) {
            usbPromptIssued = true
            if (!UsbHostPermissions.requestPermissionForDevice(this, device)) {
                if (usb.hasPermission(device)) {
                    onUsbAccessReady()
                }
            }
            return
        }
        // User closed the allow dialog without granting.
        finish()
    }

    private fun onUsbAccessReady() {
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(MainActivity.EXTRA_REFRESH_PRINTERS, true)
            },
        )
        finish()
    }
}
