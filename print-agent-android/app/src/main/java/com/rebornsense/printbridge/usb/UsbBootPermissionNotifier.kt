package com.rebornsense.printbridge.usb

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.rebornsense.printbridge.BridgeEventsLog
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * After reboot the bridge service cannot call [UsbManager.requestPermission] from the background.
 * When the system has not restored USB grant yet, post one high-priority notification that
 * launches [UsbPrinterAttachActivity] so the user taps once instead of opening Bridge.
 */
object UsbBootPermissionNotifier {
    const val ACTION_REQUEST_USB_PRINTER_PERMISSION =
        "com.rebornsense.printbridge.action.REQUEST_USB_PRINTER_PERMISSION"
    const val EXTRA_USB_DEVICE_ID = "usb_device_id"
    const val EXTRA_USB_VID = "usb_vendor_id"
    const val EXTRA_USB_PID = "usb_product_id"

    private const val PREFS = "usb_boot_permission"
    private const val KEY_NOTIFIED_BOOT = "notified_boot_wall_ms"
    private const val CHANNEL_ID = "usb_printer_permission"
    private const val NOTIFICATION_ID = 9102

    fun onDiscoveryFinished(context: Context) {
        UsbHostPermissions.promoteGrantedUsbPrinters(context)
        val missing = missingPermissionPrinterCandidates(context)
        if (missing.isEmpty()) {
            cancelNotification(context)
            return
        }
        val device = pickSingleNotificationTarget(context, missing) ?: run {
            BridgeEventsLog.record(
                context,
                "usb-permission",
                "skip notification — ${missing.size} printer candidates lack permission (ambiguous)",
            )
            return
        }
        if (alreadyNotifiedThisBoot(context)) return
        postPermissionNotification(context, device)
        markNotifiedThisBoot(context)
    }

    fun cancelNotification(context: Context) {
        context.applicationContext
            .getSystemService(NotificationManager::class.java)
            ?.cancel(NOTIFICATION_ID)
    }

    fun resolveDeviceFromIntent(context: Context, intent: Intent?): UsbDevice? {
        if (intent == null) return null
        val usb = context.getSystemService(UsbManager::class.java) ?: return null
        intent.usbDeviceExtra()?.let { return it }
        val deviceId = intent.getIntExtra(EXTRA_USB_DEVICE_ID, -1)
        if (deviceId >= 0) {
            usb.deviceList.values.firstOrNull { it.deviceId == deviceId }?.let { return it }
        }
        val vid = intent.getIntExtra(EXTRA_USB_VID, -1)
        val pid = intent.getIntExtra(EXTRA_USB_PID, -1)
        if (vid >= 0 && pid >= 0) {
            return usb.deviceList.values.firstOrNull { it.vendorId == vid && it.productId == pid }
        }
        return null
    }

    private fun pickSingleNotificationTarget(
        context: Context,
        missing: List<UsbDevice>,
    ): UsbDevice? {
        if (missing.size == 1) return missing.single()
        val app = context.applicationContext
        val remembered = missing.filter { device ->
            PrinterPreferences.isRememberedUsbDevice(app, "${device.vendorId}:${device.productId}")
        }
        if (remembered.size == 1) return remembered.single()
        val printerClass = missing.filter { device ->
            UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(app, device)
        }
        if (printerClass.size == 1) return printerClass.single()
        return null
    }

    private fun missingPermissionPrinterCandidates(context: Context): List<UsbDevice> {
        val app = context.applicationContext
        val usb = app.getSystemService(UsbManager::class.java) ?: return emptyList()
        return usb.deviceList.values.filter { device ->
            UsbDeviceClassifier.isUsbPrinterCandidate(app, device) &&
                !usb.hasPermission(device)
        }
    }

    private fun currentBootWallTimeMs(): Long =
        System.currentTimeMillis() - SystemClock.elapsedRealtime()

    private fun alreadyNotifiedThisBoot(context: Context): Boolean {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val last = prefs.getLong(KEY_NOTIFIED_BOOT, 0L)
        val boot = currentBootWallTimeMs()
        return last != 0L && kotlin.math.abs(last - boot) < 60_000L
    }

    private fun markNotifiedThisBoot(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_NOTIFIED_BOOT, currentBootWallTimeMs())
            .apply()
    }

    private fun postPermissionNotification(context: Context, device: UsbDevice) {
        val app = context.applicationContext
        ensureChannel(app)
        val label = runCatching { device.productName?.trim() }
            .getOrNull()
            ?.takeIf { it.isNotEmpty() }
            ?: "USB printer %04X:%04X".format(device.vendorId, device.productId)
        val launch = PendingIntent.getActivity(
            app,
            device.deviceId,
            Intent(app, UsbPrinterAttachActivity::class.java).apply {
                action = ACTION_REQUEST_USB_PRINTER_PERMISSION
                putExtra(EXTRA_USB_DEVICE_ID, device.deviceId)
                putExtra(EXTRA_USB_VID, device.vendorId)
                putExtra(EXTRA_USB_PID, device.productId)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val remembered = PrinterPreferences.isRememberedUsbDevice(
            app,
            "${device.vendorId}:${device.productId}",
        )
        BridgeEventsLog.record(
            app,
            "usb-permission",
            "post tap-to-allow notification for $label deviceId=${device.deviceId} remembered=$remembered",
        )
        val notification = NotificationCompat.Builder(app, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bridge)
            .setContentTitle(app.getString(R.string.usb_permission_notification_title))
            .setContentText(app.getString(R.string.usb_permission_notification_body, label))
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(app.getString(R.string.usb_permission_notification_body, label)),
            )
            .setContentIntent(launch)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .build()
        app.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.usb_permission_notification_channel),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.usb_permission_notification_channel_desc)
        }
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }
}
