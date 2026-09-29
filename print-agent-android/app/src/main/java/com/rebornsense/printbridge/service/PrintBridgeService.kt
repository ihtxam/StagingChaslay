package com.rebornsense.printbridge.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.rebornsense.printbridge.BridgeCrashLog
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
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var foregroundStarted = false

    override fun onCreate() {
        super.onCreate()
        try {
            createChannel()
            val notification = buildNotificationSafely()
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
            foregroundStarted = true
        } catch (t: Throwable) {
            foregroundStarted = false
            BridgeCrashLog.record(this, t, "onCreate/startForeground")
            stopSelf()
            return
        }
        startHttpOffMainThread()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!foregroundStarted) {
            return START_NOT_STICKY
        }
        try {
            if (intent?.action == PrintBridgeLauncher.ACTION_REFRESH_PRINTERS) {
                refreshPrintersOnBackground()
            }
        } catch (t: Throwable) {
            BridgeCrashLog.record(this, t, "onStartCommand")
            stopSelf()
        }
        // A failed start must not reboot the process. START_STICKY was the crash-haptic loop.
        return START_NOT_STICKY
    }

    private fun startHttpOffMainThread() {
        val worker = Thread {
            runCatching { queue.start(applicationContext) }
                .onFailure { BridgeCrashLog.record(applicationContext, it, "print queue") }
            runCatching {
                val http = BridgeHttpServer(PORT, applicationContext, registry, queue)
                http.start(NanoTimeout, false)
                server = http
            }.onFailure { error ->
                BridgeCrashLog.record(applicationContext, error, "HTTP server")
                mainHandler.post { runCatching { stopSelf() } }
            }
        }
        worker.name = "print-bridge-http"
        worker.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { thread, error ->
            BridgeCrashLog.record(applicationContext, error, "bridge worker ${thread.name}")
            mainHandler.post { runCatching { stopSelf() } }
        }
        worker.start()
    }

    private fun buildNotificationSafely(): Notification {
        return try {
            buildNotification()
        } catch (t: Throwable) {
            BridgeCrashLog.record(this, t, "buildNotification")
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(getString(R.string.notification_body))
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .build()
        }
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
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            setSound(null, null)
            enableVibration(false)
            enableLights(false)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
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
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .build()
    }

    companion object {
        const val PORT = 9101
        private const val CHANNEL_ID = "print_bridge"
        private const val NOTIFICATION_ID = 9101
        private const val NanoTimeout = 5000
    }
}
