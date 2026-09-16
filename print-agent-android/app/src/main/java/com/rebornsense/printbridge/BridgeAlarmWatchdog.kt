package com.rebornsense.printbridge

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.rebornsense.printbridge.boot.BridgeAlarmReceiver
import com.rebornsense.printbridge.print.PrinterPreferences

/**
 * AlarmManager-backed watchdog that keeps running after the app process is killed.
 * The in-process [BridgeServiceWatchdog] only works while the process is alive.
 */
object BridgeAlarmWatchdog {
    private const val TAG = "BridgeAlarmWatchdog"
    private const val REQUEST_CODE = 9101

    const val ACTION_CHECK = "com.rebornsense.printbridge.action.ALARM_CHECK"

    /** Poll interval while auto-start is enabled. */
    private const val INTERVAL_MS = 60_000L

    fun arm(context: Context) {
        schedule(context, INTERVAL_MS)
    }

    fun scheduleImmediate(context: Context, delayMs: Long = 3_000L) {
        schedule(context, delayMs)
    }

    fun disarm(context: Context) {
        val appContext = context.applicationContext
        val alarmManager = appContext.getSystemService(AlarmManager::class.java) ?: return
        alarmManager.cancel(pendingIntent(appContext))
    }

    private fun schedule(context: Context, delayMs: Long) {
        val appContext = context.applicationContext
        if (!PrinterPreferences.isAutoStartEnabled(appContext)) return

        val alarmManager = appContext.getSystemService(AlarmManager::class.java) ?: return
        val triggerAt = SystemClock.elapsedRealtime() + delayMs.coerceAtLeast(1_000L)
        val pendingIntent = pendingIntent(appContext)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAt,
                        pendingIntent,
                    )
                } else {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAt,
                        pendingIntent,
                    )
                }
            } else {
                @Suppress("DEPRECATION")
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
            }
            Log.d(TAG, "Scheduled bridge check in ${delayMs}ms")
        } catch (error: Exception) {
            Log.w(TAG, "Exact alarm failed, falling back to inexact", error)
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAt,
                        pendingIntent,
                    )
                }
            }
        }
    }

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, BridgeAlarmReceiver::class.java).apply {
            action = ACTION_CHECK
        }
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
