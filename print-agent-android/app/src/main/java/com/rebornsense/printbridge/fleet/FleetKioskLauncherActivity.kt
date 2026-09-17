package com.rebornsense.printbridge.fleet

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.R

/**
 * Headless kiosk entry: starts Bridge, enters lock task, opens WebPOS in the browser.
 */
class FleetKioskLauncherActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fleet_kiosk_launcher)

        if (!KioskController.isDeviceOwner(this) || !FleetPreferences.isKioskEnabled(this)) {
            finish()
            return
        }

        findViewById<TextView>(R.id.fleetKioskStatusText).text =
            getString(R.string.fleet_kiosk_launching)

        PrintBridgeLauncher.ensureRunning(this)
        KioskController.applyDeviceOwnerPolicies(this)
        KioskController.startLockTask(this)

        handler.postDelayed({
            KioskController.openWebPosInBrowser(this)
            moveTaskToBack(true)
            finish()
        }, LAUNCH_DELAY_MS)
    }

    override fun onResume() {
        super.onResume()
        if (KioskController.isDeviceOwner(this) && FleetPreferences.isKioskEnabled(this)) {
            KioskController.startLockTask(this)
        }
    }

    companion object {
        private const val LAUNCH_DELAY_MS = 800L
    }
}
