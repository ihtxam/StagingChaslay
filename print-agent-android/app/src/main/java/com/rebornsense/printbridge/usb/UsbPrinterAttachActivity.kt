package com.rebornsense.printbridge.usb

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Ojavana-style USB hot-plug: exported [UsbManager.ACTION_USB_DEVICE_ATTACHED] activity so Android
 * shows the system "Allow … USB Printer Port?" dialog even when Bridge is in the background.
 *
 * Also used from the boot notification and internal [UsbPermissionUi] launches.
 */
class UsbPrinterAttachActivity : AppCompatActivity() {
    private var usbPromptIssued = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!BridgeUserUnlock.isCredentialStorageReady(this)) {
            finish()
            return
        }
        if (!isHandledUsbIntent(intent?.action)) {
            finish()
            return
        }
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            PrintBridgeLauncher.startIfEnabled(applicationContext)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        usbPromptIssued = false
    }

    override fun onResume() {
        super.onResume()
        if (!BridgeUserUnlock.isCredentialStorageReady(this)) {
            finish()
            return
        }
        val device = UsbBootPermissionNotifier.resolveDeviceFromIntent(this, intent)
            ?: intent?.usbDeviceExtra()
        if (device == null || !UsbDeviceClassifier.isUsbPrinterCandidate(applicationContext, device)) {
            Log.d(TAG, "Skip USB attach activity — not a printer candidate")
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
        if (intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED &&
            SystemClock.elapsedRealtime() < EARLY_BOOT_MS
        ) {
            Log.d(TAG, "Defer USB permission dialog during early boot")
            finish()
            return
        }
        val systemHotPlug = intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED
        if (!systemHotPlug && UsbAttachPromptGuard.shouldSuppressPermissionDialog(this, device)) {
            finish()
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            return
        }
        if (!usbPromptIssued) {
            usbPromptIssued = true
            if (!systemHotPlug) {
                UsbAttachPromptGuard.markPromptIssued(this, device)
            }
            if (!UsbHostPermissions.requestPermissionForDevice(this, device)) {
                if (usb.hasPermission(device)) {
                    onUsbAccessReady(skipMainActivity = true)
                }
            }
            return
        }
        finish()
    }

    private fun onUsbAccessReady(skipMainActivity: Boolean = false) {
        UsbHostPermissions.promoteGrantedUsbPrinters(applicationContext)
        PrintBridgeLauncher.refreshPrinters(applicationContext)
        if (skipMainActivity || isHandledUsbIntent(intent?.action)) {
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

    private fun isHandledUsbIntent(action: String?): Boolean {
        return action == UsbManager.ACTION_USB_DEVICE_ATTACHED ||
            UsbPermissionUi.isPermissionPromptAction(action)
    }

    companion object {
        private const val TAG = "UsbPrinterAttach"
        private const val EARLY_BOOT_MS = 25_000L
    }
}
