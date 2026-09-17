package com.rebornsense.printbridge.boot

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.BridgeAlarmWatchdog
import com.rebornsense.printbridge.BridgeHealthChecker
import com.rebornsense.printbridge.BridgePermissions
import com.rebornsense.printbridge.BridgeServiceWatchdog
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.setup.OemSettingsNavigator

/**
 * Headless startup activity used after reboot (and when the watchdog needs permission)
 * so Android 13+ can grant POST_NOTIFICATIONS before the foreground service starts.
 */
class BootStartupActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var finishScheduled = false

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
            startBridgeAndFinish()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PrinterPreferences.setAutoStartEnabled(this, true)
        if (BridgePermissions.hasNotificationPermission(this)) {
            startBridgeAndFinish()
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            startBridgeAndFinish()
        }
    }

    private fun startBridgeAndFinish() {
        if (!OemSettingsNavigator.isBatteryOptimizationDisabled(this)) {
            OemSettingsNavigator.openBatteryOptimizationRequest(this)
        }
        PrintBridgeLauncher.start(this)
        PrintBridgeLauncher.refreshPrinters(this)
        BridgeServiceWatchdog.start(applicationContext)
        BridgeAlarmWatchdog.arm(applicationContext)
        waitForHealthyThenFinish()
    }

    private fun waitForHealthyThenFinish() {
        if (finishScheduled) return
        var attempts = 0
        val poll = object : Runnable {
            override fun run() {
                attempts += 1
                if (BridgeHealthChecker.isHealthy() || attempts >= MAX_HEALTH_POLLS) {
                    finishScheduled = true
                    moveTaskToBack(true)
                    finish()
                    return
                }
                PrintBridgeLauncher.start(this@BootStartupActivity)
                handler.postDelayed(this, HEALTH_POLL_MS)
            }
        }
        handler.postDelayed(poll, HEALTH_POLL_MS)
    }

    companion object {
        const val EXTRA_FROM_BOOT = "from_boot"
        private const val HEALTH_POLL_MS = 750L
        private const val MAX_HEALTH_POLLS = 40
    }
}
