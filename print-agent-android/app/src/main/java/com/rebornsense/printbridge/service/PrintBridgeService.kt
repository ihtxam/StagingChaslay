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
import android.util.Log
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
import com.rebornsense.printbridge.usb.UsbBootPermissionNotifier
import com.rebornsense.printbridge.usb.UsbHostPermissions

class PrintBridgeService : Service() {
    private var server: BridgeHttpServer? = null
    private val registry = DriverRegistry()
    private val queue = PrintJobQueue(registry)
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var discoveryGeneration = 0

    @Volatile
    private var discoveryThread: Thread? = null

    @Volatile
    private var foregroundStarted = false

    @Volatile
    private var httpListening = false

    @Volatile
    private var failureRecorded = false

    override fun onCreate() {
        super.onCreate()
        try {
            createChannel()
            val notification = buildNotificationSafely()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // connectedDevice is legal from BOOT_COMPLETED. dataSync is not (Android 15).
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            }
            foregroundStarted = true
        } catch (t: Throwable) {
            foregroundStarted = false
            noteFailure(
                "startForeground",
                t.message?.takeIf { it.isNotBlank() } ?: t.javaClass.simpleName,
                t,
            )
            stopSelf()
            return
        }
        startHttpOffMainThread()
        schedulePrinterDiscovery()
        schedulePermissionRecheck()
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
            noteFailure(
                "onStartCommand",
                t.message?.takeIf { it.isNotBlank() } ?: t.javaClass.simpleName,
                t,
            )
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
                httpListening = true
            }.onFailure { error ->
                noteFailure(
                    "HTTP server",
                    error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName,
                    error,
                )
                mainHandler.post { runCatching { stopSelf() } }
            }
        }
        worker.name = "print-bridge-http"
        worker.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { thread, error ->
            noteFailure(
                "bridge worker ${thread.name}",
                error.message?.takeIf { it.isNotBlank() } ?: "bridge worker crashed",
                error,
            )
            mainHandler.post { runCatching { stopSelf() } }
        }
        worker.start()
    }

    /** Writes a short reason then the stack. Does not kill the activity. */
    private fun noteFailure(source: String, reason: String, error: Throwable) {
        failureRecorded = true
        markFailed()
        BridgeCrashLog.recordReason(applicationContext, source, reason)
        BridgeCrashLog.record(applicationContext, error, source)
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
        val worker = Thread { discoverPrintersQuietly() }
        worker.name = "print-bridge-refresh"
        worker.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { thread, error ->
            Log.e(TAG, "printer refresh failed on ${thread.name}", error)
        }
        worker.start()
    }

    /**
     * USB enumeration is not ready in the same moment as startForeground, and a scan
     * on the main thread crashes multi-peripheral tablets. Wait, then fill the registry
     * so /printers and /print work without opening the app. Failures are logged only.
     */
    /** Some Nebullus hubs enumerate the receipt printer a few seconds after boot. */
    private fun schedulePermissionRecheck() {
        val worker = Thread {
            try {
                Thread.sleep(PERMISSION_RECHECK_MS)
            } catch (_: InterruptedException) {
                return@Thread
            }
            if (!foregroundStarted) return@Thread
            runCatching { UsbBootPermissionNotifier.onDiscoveryFinished(applicationContext) }
                .onFailure { error -> Log.w(TAG, "USB permission recheck failed", error) }
        }
        worker.name = "print-bridge-usb-perm"
        worker.isDaemon = true
        worker.start()
    }

    private fun schedulePrinterDiscovery() {
        val generation = ++discoveryGeneration
        val worker = Thread {
            try {
                Thread.sleep(DISCOVERY_DELAY_MS)
            } catch (_: InterruptedException) {
                return@Thread
            }
            if (generation != discoveryGeneration || !foregroundStarted) return@Thread
            discoverPrintersQuietly()
        }
        worker.name = "print-bridge-discover"
        worker.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { thread, error ->
            Log.e(TAG, "printer discovery failed on ${thread.name}", error)
        }
        discoveryThread?.interrupt()
        discoveryThread = worker
        worker.start()
    }

    private fun discoverPrintersQuietly() {
        runCatching { UsbHostPermissions.recordGrantedDevices(applicationContext) }
            .onFailure { error -> Log.w(TAG, "record granted USB devices failed", error) }
        runCatching { registry.refresh(applicationContext) }
            .onFailure { error -> Log.w(TAG, "printer discovery failed", error) }
        runCatching { UsbBootPermissionNotifier.onDiscoveryFinished(applicationContext) }
            .onFailure { error -> Log.w(TAG, "USB permission notifier failed", error) }
    }

    override fun onDestroy() {
        discoveryGeneration++
        discoveryThread?.interrupt()
        discoveryThread = null
        if (foregroundStarted && !httpListening && !failureRecorded) {
            failureRecorded = true
            markFailed()
            BridgeCrashLog.recordReason(
                applicationContext,
                "service",
                "Bridge service stopped before it stayed running",
            )
        }
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
        private const val TAG = "PrintBridgeService"
        const val PORT = 9101
        private const val CHANNEL_ID = "print_bridge"
        private const val NOTIFICATION_ID = 9101
        private const val NanoTimeout = 5000
        private const val DISCOVERY_DELAY_MS = 2_000L
        private const val PERMISSION_RECHECK_MS = 12_000L

        @Volatile
        private var failureGenerationCount: Int = 0

        fun failureGeneration(): Int = failureGenerationCount

        fun markFailed() {
            failureGenerationCount++
        }
    }
}
