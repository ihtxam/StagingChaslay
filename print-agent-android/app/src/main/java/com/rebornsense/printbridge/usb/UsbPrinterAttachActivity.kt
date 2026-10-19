package com.rebornsense.printbridge.usb

import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Ojavana-style USB hot-plug: exported [UsbManager.ACTION_USB_DEVICE_ATTACHED] activity so Android
 * shows the system "Allow … USB Printer Port?" dialog even when Bridge is in the background.
 *
 * Also used from the boot notification and internal [UsbPermissionUi] launches.
 */
class UsbPrinterAttachActivity : AppCompatActivity() {
    private var usbPromptIssued = false
    private var targetDevice: UsbDevice? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        if (!BridgeUserUnlock.isCredentialStorageReady(this)) {
            finish()
            return
        }
        if (!isHandledUsbIntent(intent?.action)) {
            finish()
            return
        }
        val bootOrAttach =
            intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED ||
                UsbPermissionUi.isPermissionPromptAction(intent?.action)
        if (bootOrAttach && PrinterPreferences.isAutoStartEnabled(this)) {
            PrintBridgeLauncher.start(this, recordBlockedStartInCrashLog = false)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        usbPromptIssued = false
        targetDevice = null
    }

    override fun onStart() {
        super.onStart()
        UsbHostPermissions.onPermissionSettled = permissionSettledListener
    }

    override fun onStop() {
        UsbHostPermissions.onPermissionSettled = null
        super.onStop()
    }

    private val permissionSettledListener: () -> Unit = { onPermissionBroadcastSettled() }

    override fun onResume() {
        super.onResume()
        if (!BridgeUserUnlock.isCredentialStorageReady(this)) {
            finish()
            return
        }
        val device = resolveTargetDevice()
            ?: UsbPlugPlay.pickBestMissingPrinter(applicationContext)
        if (device == null || !UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(applicationContext, device)) {
            Log.d(TAG, "Skip USB attach activity — not a printer candidate")
            finish()
            return
        }
        targetDevice = device
        val usb = getSystemService(UsbManager::class.java) ?: run {
            finish()
            return
        }
        val systemHotPlug = intent?.action == UsbManager.ACTION_USB_DEVICE_ATTACHED
        if (systemHotPlug) {
            // Boot/service may have left a stale pending flag without ever showing the dialog.
            UsbHostPermissions.clearStalePendingRequest(usb, maxAgeMs = 3_000L)
        } else {
            UsbHostPermissions.clearStalePendingRequest(usb)
        }
        UsbHostPermissions.recordGrantedDevices(this)
        if (usb.hasPermission(device)) {
            UsbBootPermissionNotifier.cancelNotification(this)
            onUsbAccessReady(skipMainActivity = true)
            return
        }
        Log.i(TAG, "USB permission missing — open MainActivity for system dialog")
        if (UsbPermissionUi.launchMainActivityForUsbPermission(this, device, minimizeAfter = true)) {
            finish()
            return
        }
        if (!systemHotPlug && UsbAttachPromptGuard.shouldSuppressPermissionDialog(this, device)) {
            finish()
            return
        }
        if (UsbHostPermissions.isRequestPending()) {
            Log.d(TAG, "USB permission dialog already pending — waiting for user")
            return
        }
        schedulePermissionPrompt(device, systemHotPlug)
    }

    private fun schedulePermissionPrompt(device: UsbDevice, systemHotPlug: Boolean) {
        if (usbPromptIssued) return
        window?.decorView?.post {
            if (isFinishing || isDestroyed) return@post
            val usb = getSystemService(UsbManager::class.java) ?: return@post
            val current = resolveTargetDevice() ?: device
            if (usb.hasPermission(current)) {
                onUsbAccessReady(skipMainActivity = true)
                return@post
            }
            if (UsbHostPermissions.isRequestPending()) return@post
            usbPromptIssued = true
            if (!systemHotPlug) {
                UsbAttachPromptGuard.markPromptIssued(this, current)
            }
            if (!UsbHostPermissions.requestPermissionForDevice(this, current)) {
                if (usb.hasPermission(current)) {
                    onUsbAccessReady(skipMainActivity = true)
                }
            }
        }
    }

    private fun onPermissionBroadcastSettled() {
        if (isFinishing || isDestroyed) return
        val device = resolveTargetDevice() ?: return
        val usb = getSystemService(UsbManager::class.java) ?: return
        if (usb.hasPermission(device)) {
            onUsbAccessReady(skipMainActivity = true)
        }
    }

    private fun resolveTargetDevice(): UsbDevice? {
        return UsbBootPermissionNotifier.resolveDeviceFromIntent(this, intent)
            ?: intent?.usbDeviceExtra()
            ?: targetDevice
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
    }
}
