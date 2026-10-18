package com.rebornsense.printbridge.boot

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.rebornsense.printbridge.BridgePermissions
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * After reboot, [com.rebornsense.printbridge.PrintBridgeLauncher] cannot start the foreground
 * service without POST_NOTIFICATIONS. Post one notification so the merchant can tap once.
 */
object BootAutostartNotifier {
    private const val PREFS = "boot_autostart_notify"
    private const val KEY_NOTIFIED_BOOT = "notified_boot_wall_ms"
    private const val CHANNEL_ID = "bridge_autostart"
    private const val NOTIFICATION_ID = 9103

    fun notifyIfAutoStartBlocked(context: Context) {
        val app = context.applicationContext
        if (!PrinterPreferences.isAutoStartEnabled(app)) return
        if (BridgePermissions.hasNotificationPermission(app)) return
        if (alreadyNotifiedThisBoot(app)) return
        ensureChannel(app)
        val launch = PendingIntent.getActivity(
            app,
            0,
            Intent(app, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(app, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(app.getString(R.string.boot_autostart_notification_title))
            .setContentText(app.getString(R.string.boot_autostart_notification_body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(launch)
            .setAutoCancel(true)
            .build()
        app.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification)
        markNotifiedThisBoot(app)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.boot_autostart_notification_channel),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.boot_autostart_notification_channel_desc)
        }
        manager.createNotificationChannel(channel)
    }

    private fun currentBootWallTimeMs(): Long =
        System.currentTimeMillis() - SystemClock.elapsedRealtime()

    private fun alreadyNotifiedThisBoot(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val last = prefs.getLong(KEY_NOTIFIED_BOOT, 0L)
        val boot = currentBootWallTimeMs()
        return last != 0L && kotlin.math.abs(last - boot) < 120_000L
    }

    private fun markNotifiedThisBoot(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_NOTIFIED_BOOT, currentBootWallTimeMs())
            .apply()
    }
}
