package com.rebornsense.printbridge.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.rebornsense.printbridge.MainActivity
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.setup.OemSetupPreferences
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.http.BridgeHttpServer
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrintJobQueue
import com.rebornsense.printbridge.usb.UsbHostPermissions

class PrintBridgeService : Service() {
    private var server: BridgeHttpServer? = null
    private val registry = DriverRegistry()
    private val queue = PrintJobQueue(registry)
    override fun onCreate() {
        super.onCreate()
        try {
            createChannel()
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (t: Throwable) {
            Log.e(TAG, "PrintBridgeService failed to enter foreground", t)
            stopSelf()
            return
        }
        val worker = Thread {
            runCatching { queue.start(applicationContext) }
                .onFailure { Log.e(TAG, "print queue failed", it) }
            runCatching {
                val http = BridgeHttpServer(PORT, applicationContext, registry, queue)
                http.start(NanoTimeout, false)
                server = http
            }.onFailure { Log.e(TAG, "HTTP server failed", it) }
        }
        worker.name = "print-bridge-http"
        worker.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { _, error ->
            Log.e(TAG, "bridge worker crashed", error)
        }
        worker.start()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == PrintBridgeLauncher.ACTION_REFRESH_PRINTERS) {
            refreshPrintersOnBackground()
        }
        return START_STICKY
    }

    private fun refreshPrintersOnBackground() {
        Thread {
            runCatching { UsbHostPermissions.recordGrantedDevices(applicationContext) }
            runCatching { registry.refresh(applicationContext) }
        }.start()
    }

    override fun onDestroy() {
        server?.stop()
        server = null
        queue.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    fun registry(): DriverRegistry = registry

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel),
            NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val launch = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val needsSetup = !OemSetupPreferences.isWizardCompleted(this)
        val body = if (needsSetup) {
            getString(R.string.notification_setup_needed)
        } else {
            getString(R.string.notification_body)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_stat_bridge)
            .setContentIntent(launch)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "PrintBridgeService"
        const val PORT = 9101
        private const val CHANNEL_ID = "print_bridge"
        private const val NOTIFICATION_ID = 9101
        private const val NanoTimeout = 5000
    }
}
