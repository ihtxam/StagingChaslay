package com.rebornsense.printbridge.setup

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.device.DeviceProfiler

class SetupWizardActivity : AppCompatActivity() {
    private lateinit var steps: List<OemSetupStep>
    private var stepIndex = 0

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
        findViewById<MaterialButton>(R.id.wizardNextBtn).setOnClickListener { goToNextStep() }

        renderStep()
    }

    override fun onResume() {
        super.onResume()
        renderStep()
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
                nextBtn.text = if (step.id == "done") {
                    getString(R.string.oem_step_finish)
                } else {
                    getString(R.string.oem_step_next)
                }
                statusText.visibility = View.GONE
            }
            OemSetupAction.OPEN_BATTERY -> {
                secondaryBtn.visibility = View.VISIBLE
                skipBtn.visibility = View.VISIBLE
                nextBtn.visibility = View.VISIBLE
                renderBatteryStatus(statusText)
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

    private fun updateAutoComplete(step: OemSetupStep) {
        if (step.id == "battery" && OemSettingsNavigator.isBatteryOptimizationDisabled(this)) {
            OemSetupPreferences.setStepCompleted(this, step.id, true)
        }
    }

    private fun onPrimaryAction() {
        val step = currentStep()
        when (step.action) {
            OemSetupAction.OPEN_BATTERY -> OemSettingsNavigator.openBatteryOptimizationRequest(this)
            OemSetupAction.OPEN_AUTOSTART -> OemSettingsNavigator.openAutostartSettings(this)
            OemSetupAction.OPEN_BACKGROUND -> OemSettingsNavigator.openBackgroundActivitySettings(this)
            OemSetupAction.INSTRUCTION_ONLY -> goToNextStep()
        }
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

        fun createIntent(context: android.content.Context): Intent {
            return Intent(context, SetupWizardActivity::class.java)
        }
    }
}
