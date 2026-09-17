package com.rebornsense.printbridge.setup

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.rebornsense.printbridge.BridgeHealthChecker
import com.rebornsense.printbridge.BridgePermissions
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.device.DeviceProfiler

class SetupWizardActivity : AppCompatActivity() {
    private lateinit var steps: List<OemSetupStep>
    private var stepIndex = 0
    private val healthHandler = Handler(Looper.getMainLooper())
    private var healthPollRunnable: Runnable? = null
    private var bridgeStartAttempts = 0
    private var awaitingNotificationPermission = false

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            awaitingNotificationPermission = false
            if (granted) {
                startBridgeAndPoll()
            } else {
                showNotificationPermissionRequired()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup_wizard)
        steps = OemSetupSteps.forDevice()
        stepIndex = savedInstanceState?.getInt(STATE_STEP_INDEX) ?: firstIncompleteStepIndex()

        findViewById<TextView>(R.id.wizardDeviceLabel).text =
            getString(R.string.oem_setup_device_label, DeviceProfiler.detect().displayName)

        findViewById<MaterialButton>(R.id.wizardPrimaryBtn).setOnClickListener { onPrimaryAction() }
        findViewById<MaterialButton>(R.id.wizardSecondaryBtn).setOnClickListener { markCurrentStepDone() }
        findViewById<MaterialButton>(R.id.wizardSkipBtn).setOnClickListener { goToNextStep() }
        findViewById<MaterialButton>(R.id.wizardNextBtn).setOnClickListener { onNextAction() }

        renderStep()
    }

    override fun onResume() {
        super.onResume()
        renderStep()
        if (currentStep().action == OemSetupAction.START_BRIDGE) {
            if (BridgeHealthChecker.isHealthy()) {
                renderBridgeStatus(findViewById(R.id.wizardStatusText))
            } else if (!awaitingNotificationPermission && healthPollRunnable == null) {
                ensureBridgeRunningWithPermission()
            } else {
                pollBridgeHealth(showChecking = false)
            }
        }
    }

    override fun onPause() {
        stopHealthPolling()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(STATE_STEP_INDEX, stepIndex)
    }

    private fun firstIncompleteStepIndex(): Int {
        val idx = steps.indexOfFirst { !OemSetupPreferences.isStepCompleted(this, it.id) }
        return if (idx >= 0) idx else 0
    }

    private fun currentStep(): OemSetupStep = steps[stepIndex]

    private fun renderStep() {
        val step = currentStep()
        updateAutoComplete(step)

        findViewById<TextView>(R.id.wizardStepIndicator).text =
            getString(R.string.oem_setup_step_indicator, stepIndex + 1, steps.size)
        findViewById<LinearProgressIndicator>(R.id.wizardProgress).apply {
            max = steps.size
            setProgressCompat(stepIndex + 1, true)
        }
        findViewById<TextView>(R.id.wizardStepTitle).setText(step.titleRes)
        findViewById<TextView>(R.id.wizardStepDescription).setText(step.descriptionRes)

        val primaryBtn = findViewById<MaterialButton>(R.id.wizardPrimaryBtn)
        primaryBtn.setText(step.actionLabelRes)

        val secondaryBtn = findViewById<MaterialButton>(R.id.wizardSecondaryBtn)
        val skipBtn = findViewById<MaterialButton>(R.id.wizardSkipBtn)
        val nextBtn = findViewById<MaterialButton>(R.id.wizardNextBtn)
        val statusText = findViewById<TextView>(R.id.wizardStatusText)

        when (step.action) {
            OemSetupAction.INSTRUCTION_ONLY -> {
                secondaryBtn.visibility = View.GONE
                skipBtn.visibility = if (step.id == "done") View.GONE else View.VISIBLE
                nextBtn.visibility = View.VISIBLE
                nextBtn.text = when (step.id) {
                    "done" -> getString(R.string.oem_step_open_webpos)
                    "tap_to_pay" -> getString(R.string.oem_step_open_webpos)
                    else -> getString(R.string.oem_step_next)
                }
                if (step.id == "tap_to_pay") {
                    statusText.visibility = View.VISIBLE
                    statusText.text = if (OemSetupPreferences.isTapToPayDeviceRegistered(this)) {
                        getString(R.string.oem_step_tap_to_pay_done)
                    } else {
                        getString(R.string.oem_step_tap_to_pay_pending)
                    }
                } else {
                    statusText.visibility = View.GONE
                }
            }
            OemSetupAction.OPEN_BATTERY -> {
                secondaryBtn.visibility = View.VISIBLE
                skipBtn.visibility = View.VISIBLE
                nextBtn.visibility = View.VISIBLE
                renderBatteryStatus(statusText)
            }
            OemSetupAction.START_BRIDGE -> {
                secondaryBtn.visibility = View.VISIBLE
                skipBtn.visibility = View.VISIBLE
                nextBtn.visibility = View.VISIBLE
                renderBridgeStatus(statusText)
            }
            else -> {
                secondaryBtn.visibility = View.VISIBLE
                skipBtn.visibility = View.VISIBLE
                nextBtn.visibility = View.VISIBLE
                statusText.visibility = View.GONE
            }
        }
    }

    private fun renderBatteryStatus(statusText: TextView) {
        if (OemSettingsNavigator.isBatteryOptimizationDisabled(this)) {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_battery_done)
            OemSetupPreferences.setStepCompleted(this, "battery", true)
        } else {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_battery_pending)
        }
    }

    private fun renderBridgeStatus(statusText: TextView) {
        val health = BridgeHealthChecker.probeHealth()
        if (health != null) {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(
                R.string.oem_step_bridge_verified,
                health.version ?: getString(R.string.oem_step_bridge_version_unknown),
            )
            OemSetupPreferences.setStepCompleted(this, "start_bridge", true)
        } else if (awaitingNotificationPermission) {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_bridge_notification_prompt)
        } else if (healthPollRunnable != null) {
            // pollBridgeHealth updates status text
        } else if (!BridgePermissions.hasNotificationPermission(this)) {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_bridge_notification_required)
        } else {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_bridge_pending)
        }
    }

    private fun updateAutoComplete(step: OemSetupStep) {
        if (step.id == "battery" && OemSettingsNavigator.isBatteryOptimizationDisabled(this)) {
            OemSetupPreferences.setStepCompleted(this, step.id, true)
        }
        if (step.id == "start_bridge" && BridgeHealthChecker.isHealthy()) {
            OemSetupPreferences.setStepCompleted(this, step.id, true)
        }
        if (step.id == "tap_to_pay" && OemSetupPreferences.isTapToPayDeviceRegistered(this)) {
            OemSetupPreferences.setStepCompleted(this, step.id, true)
        }
    }

    private fun onPrimaryAction() {
        val step = currentStep()
        when (step.action) {
            OemSetupAction.OPEN_BATTERY -> OemSettingsNavigator.openBatteryOptimizationRequest(this)
            OemSetupAction.OPEN_AUTOSTART -> OemSettingsNavigator.openAutostartSettings(this)
            OemSetupAction.OPEN_BACKGROUND -> OemSettingsNavigator.openBackgroundActivitySettings(this)
            OemSetupAction.START_BRIDGE -> ensureBridgeRunningWithPermission()
            OemSetupAction.INSTRUCTION_ONLY -> {
                if (step.id == "tap_to_pay") {
                    openWebPosTapToPaySetup()
                } else if (step.id == "done") {
                    openWebPos()
                } else {
                    onNextAction()
                }
            }
        }
    }

    private fun onNextAction() {
        val step = currentStep()
        if (step.id == "done" || step.id == "tap_to_pay") {
            if (step.id == "done") {
                openWebPos()
            } else {
                openWebPosTapToPaySetup()
            }
            if (step.id == "done") {
                finishWizard()
            }
            return
        }
        goToNextStep()
    }

    private fun ensureBridgeRunningWithPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            BridgePermissions.needsNotificationPermission(this)
        ) {
            awaitingNotificationPermission = true
            val statusText = findViewById<TextView>(R.id.wizardStatusText)
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_bridge_notification_prompt)
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        startBridgeAndPoll()
    }

    private fun showNotificationPermissionRequired() {
        val statusText = findViewById<TextView>(R.id.wizardStatusText)
        statusText.visibility = View.VISIBLE
        statusText.text = getString(R.string.oem_step_bridge_notification_denied)
    }

    private fun startBridgeAndPoll() {
        bridgeStartAttempts += 1
        PrintBridgeLauncher.start(this)
        pollBridgeHealth(showChecking = true)
    }

    private fun pollBridgeHealth(showChecking: Boolean) {
        stopHealthPolling()
        val statusText = findViewById<TextView>(R.id.wizardStatusText)
        if (showChecking) {
            statusText.visibility = View.VISIBLE
            statusText.text = getString(R.string.oem_step_bridge_checking, 1, HEALTH_POLL_MAX_ATTEMPTS)
        }

        var attempts = 0
        healthPollRunnable = object : Runnable {
            override fun run() {
                attempts += 1
                val health = BridgeHealthChecker.probeHealth()
                if (health != null) {
                    statusText.visibility = View.VISIBLE
                    statusText.text = getString(
                        R.string.oem_step_bridge_verified,
                        health.version ?: getString(R.string.oem_step_bridge_version_unknown),
                    )
                    OemSetupPreferences.setStepCompleted(this@SetupWizardActivity, "start_bridge", true)
                    stopHealthPolling()
                    return
                }

                if (!BridgePermissions.hasNotificationPermission(this@SetupWizardActivity)) {
                    statusText.visibility = View.VISIBLE
                    statusText.text = getString(R.string.oem_step_bridge_notification_denied)
                    stopHealthPolling()
                    return
                }

                // Re-trigger FGS periodically while waiting (OEMs may delay or reject first start).
                if (attempts % SERVICE_RESTART_EVERY_ATTEMPTS == 0) {
                    PrintBridgeLauncher.start(this@SetupWizardActivity)
                }

                if (attempts >= HEALTH_POLL_MAX_ATTEMPTS) {
                    statusText.visibility = View.VISIBLE
                    statusText.text = getString(R.string.oem_step_bridge_failed)
                    stopHealthPolling()
                    // Auto-retry once without requiring another tap.
                    if (bridgeStartAttempts < MAX_BRIDGE_START_ROUNDS) {
                        healthHandler.postDelayed({
                            if (currentStep().action == OemSetupAction.START_BRIDGE &&
                                !BridgeHealthChecker.isHealthy()
                            ) {
                                startBridgeAndPoll()
                            }
                        }, AUTO_RETRY_DELAY_MS)
                    }
                    return
                }

                statusText.visibility = View.VISIBLE
                statusText.text = getString(
                    R.string.oem_step_bridge_checking,
                    attempts,
                    HEALTH_POLL_MAX_ATTEMPTS,
                )
                healthHandler.postDelayed(this, HEALTH_POLL_INTERVAL_MS)
            }
        }
        healthHandler.post(healthPollRunnable!!)
    }

    private fun stopHealthPolling() {
        healthPollRunnable?.let { healthHandler.removeCallbacks(it) }
        healthPollRunnable = null
    }

    private fun openWebPos() {
        val webPosUrl = resolveWebPosUrl()
        val launch = packageManager.getLaunchIntentForPackage("com.android.chrome")
            ?: packageManager.getLaunchIntentForPackage("com.chrome.beta")
        if (launch != null) {
            launch.data = Uri.parse(webPosUrl)
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(launch)
            return
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(webPosUrl)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    private fun openWebPosTapToPaySetup() {
        openWebPosWithQuery("tapToPaySetup=1")
    }

    private fun openWebPosWithQuery(query: String) {
        val base = resolveWebPosUrl()
        val url = if (base.contains("?")) "$base&$query" else "$base?$query"
        val launch = packageManager.getLaunchIntentForPackage("com.android.chrome")
            ?: packageManager.getLaunchIntentForPackage("com.chrome.beta")
        if (launch != null) {
            launch.data = Uri.parse(url)
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(launch)
            return
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    private fun resolveWebPosUrl(): String {
        val stored = OemSetupPreferences.getWebPosOrigin(this)
        val host = stored?.trimEnd('/') ?: "https://app.chaslay.com"
        return "$host/merchant/pos"
    }

    private fun markCurrentStepDone() {
        OemSetupPreferences.setStepCompleted(this, currentStep().id, true)
        goToNextStep()
    }

    private fun goToNextStep() {
        OemSetupPreferences.setStepCompleted(this, currentStep().id, true)
        if (stepIndex >= steps.lastIndex) {
            finishWizard()
            return
        }
        stepIndex += 1
        renderStep()
    }

    private fun finishWizard() {
        OemSetupPreferences.setWizardCompleted(this, true)
        setResult(RESULT_OK)
        finish()
    }

    companion object {
        private const val STATE_STEP_INDEX = "step_index"
        private const val HEALTH_POLL_INTERVAL_MS = 500L
        private const val HEALTH_POLL_MAX_ATTEMPTS = 60
        private const val SERVICE_RESTART_EVERY_ATTEMPTS = 5
        private const val MAX_BRIDGE_START_ROUNDS = 3
        private const val AUTO_RETRY_DELAY_MS = 2_000L

        fun createIntent(context: android.content.Context): Intent {
            return Intent(context, SetupWizardActivity::class.java)
        }
    }
}
