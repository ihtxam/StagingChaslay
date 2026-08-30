package com.rebornsense.printbridge.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.rebornsense.printbridge.setup.OemSetupPreferences
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.http.BridgeHttpServer
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrintJobQueue

class PrintBridgeService : Service() {
    private var server: BridgeHttpServer? = null
    private val registry = DriverRegistry()
    private val queue = PrintJobQueue(registry)
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            registry.refresh(applicationContext)
            refreshHandler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        registry.refresh(applicationContext)
        queue.start(applicationContext)
        server = BridgeHttpServer(PORT, applicationContext, registry, queue).also {
            it.start(NanoTimeout, false)
        }
        refreshHandler.postDelayed(refreshRunnable, WATCHDOG_INTERVAL_MS)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == PrintBridgeLauncher.ACTION_REFRESH_PRINTERS) {
            registry.refresh(applicationContext)
            return START_STICKY
        }
        registry.refresh(applicationContext)
        return START_STICKY
    }

    override fun onDestroy() {
        refreshHandler.removeCallbacks(refreshRunnable)
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
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentIntent(launch)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val PORT = 9101
        private const val CHANNEL_ID = "print_bridge"
        private const val NOTIFICATION_ID = 9101
        private const val NanoTimeout = 5000
        private const val WATCHDOG_INTERVAL_MS = 30_000L
    }
}
