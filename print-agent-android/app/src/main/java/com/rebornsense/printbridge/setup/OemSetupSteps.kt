package com.rebornsense.printbridge.setup

import com.rebornsense.printbridge.R
import com.rebornsense.printbridge.device.DeviceProfiler

enum class OemSetupAction {
    OPEN_BATTERY,
    OPEN_AUTOSTART,
    OPEN_BACKGROUND,
    INSTRUCTION_ONLY,
}

data class OemSetupStep(
    val id: String,
    val titleRes: Int,
    val descriptionRes: Int,
    val actionLabelRes: Int,
    val action: OemSetupAction,
    val autoComplete: () -> Boolean = { false },
)

object OemSetupSteps {
    fun forDevice(): List<OemSetupStep> {
        return when (DeviceProfiler.detect()) {
            DeviceProfiler.Profile.SUNMI -> sunmiSteps()
            DeviceProfiler.Profile.FEITIAN -> feitianSteps()
            DeviceProfiler.Profile.GENERIC_CHINESE -> genericChineseSteps()
            DeviceProfiler.Profile.GENERIC_ANDROID -> genericAndroidSteps()
        }
    }

    private fun sunmiSteps(): List<OemSetupStep> = listOf(
        welcomeStep(),
        batteryStep(),
        OemSetupStep(
            id = "sunmi_autostart",
            titleRes = R.string.oem_step_sunmi_autostart_title,
            descriptionRes = R.string.oem_step_sunmi_autostart_desc,
            actionLabelRes = R.string.oem_step_open_autostart,
            action = OemSetupAction.OPEN_AUTOSTART,
        ),
        doneStep(),
    )

    private fun feitianSteps(): List<OemSetupStep> = listOf(
        welcomeStep(),
        batteryStep(),
        OemSetupStep(
            id = "feitian_background",
            titleRes = R.string.oem_step_feitian_background_title,
            descriptionRes = R.string.oem_step_feitian_background_desc,
            actionLabelRes = R.string.oem_step_open_app_settings,
            action = OemSetupAction.OPEN_BACKGROUND,
        ),
        doneStep(),
    )

    private fun genericChineseSteps(): List<OemSetupStep> = listOf(
        welcomeStep(),
        batteryStep(),
        OemSetupStep(
            id = "generic_autostart",
            titleRes = R.string.oem_step_autostart_title,
            descriptionRes = R.string.oem_step_autostart_desc,
            actionLabelRes = R.string.oem_step_open_autostart,
            action = OemSetupAction.OPEN_AUTOSTART,
        ),
        OemSetupStep(
            id = "generic_lock_recents",
            titleRes = R.string.oem_step_lock_recents_title,
            descriptionRes = R.string.oem_step_lock_recents_desc,
            actionLabelRes = R.string.oem_step_mark_done,
            action = OemSetupAction.INSTRUCTION_ONLY,
        ),
        doneStep(),
    )

    private fun genericAndroidSteps(): List<OemSetupStep> = listOf(
        welcomeStep(),
        batteryStep(),
        doneStep(),
    )

    private fun welcomeStep(): OemSetupStep = OemSetupStep(
        id = "welcome",
        titleRes = R.string.oem_step_welcome_title,
        descriptionRes = R.string.oem_step_welcome_desc,
        actionLabelRes = R.string.oem_step_continue,
        action = OemSetupAction.INSTRUCTION_ONLY,
    )

    private fun batteryStep(): OemSetupStep = OemSetupStep(
        id = "battery",
        titleRes = R.string.oem_step_battery_title,
        descriptionRes = R.string.oem_step_battery_desc,
        actionLabelRes = R.string.oem_step_open_battery,
        action = OemSetupAction.OPEN_BATTERY,
        autoComplete = { false },
    )

    private fun doneStep(): OemSetupStep = OemSetupStep(
        id = "done",
        titleRes = R.string.oem_step_done_title,
        descriptionRes = R.string.oem_step_done_desc,
        actionLabelRes = R.string.oem_step_finish,
        action = OemSetupAction.INSTRUCTION_ONLY,
    )
}
