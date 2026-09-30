package com.rebornsense.printbridge.usb

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Shown only from the boot notification when USB permission is missing after reboot.
 * Hot-plug uses [UsbAttachReceiver] + [UsbManager.requestPermission] (no "Open app to handle USB?" chooser).
 */
class UsbPrinterAttachActivity : AppCompatActivity() {
    private var usbPromptIssued = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent?.action != UsbBootPermissionNotifier.ACTION_REQUEST_USB_PRINTER_PERMISSION) {
            finish()
            return
        }
    }

    override fun onResume() {
        super.onResume()
        val device = UsbBootPermissionNotifier.resolveDeviceFromIntent(this, intent)
            ?: intent?.usbDeviceExtra()
        if (device == null || !UsbDeviceClassifier.isUsbPrinterCandidate(applicationContext, device)) {
            finish()
            return
        }
        val usb = getSystemService(UsbManager::class.java) ?: run {
            finish()
            return
        }
        UsbHostPermissions.recordGrantedDevices(this)
        if (usb.hasPermission(device)) {
            UsbBootPermissionNotifier.cancelNotification(this)
            onUsbAccessReady(skipMainActivity = true)
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(this, device)) {
            finish()
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            return
        }
        if (!usbPromptIssued) {
            usbPromptIssued = true
            UsbAttachPromptGuard.markPromptIssued(this, device)
            if (!UsbHostPermissions.requestPermissionForDevice(this, device)) {
                if (usb.hasPermission(device)) {
                    onUsbAccessReady(skipMainActivity = true)
                }
            }
            return
        }
        // User closed the allow dialog without granting.
        finish()
    }

    private fun onUsbAccessReady(skipMainActivity: Boolean = false) {
        UsbHostPermissions.promoteGrantedUsbPrinters(applicationContext)
        PrintBridgeLauncher.refreshPrinters(applicationContext)
        if (
            skipMainActivity ||
            intent?.action == UsbBootPermissionNotifier.ACTION_REQUEST_USB_PRINTER_PERMISSION
        ) {
            finish()
            return
        }
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(MainActivity.EXTRA_REFRESH_PRINTERS, true)
            },
        )
        finish()
    }
}
