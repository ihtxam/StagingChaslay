package com.rebornsense.printbridge.setup

import android.content.Context

object OemSetupPreferences {
    private const val PREFS = "reborn_print_bridge_oem_setup"
    private const val KEY_WIZARD_COMPLETED = "wizard_completed"
    private const val KEY_TAP_TO_PAY_REGISTERED = "tap_to_pay_device_registered"
    private const val KEY_STEP_PREFIX = "step_"
    /** When this differs from the installed versionCode, the setup wizard runs again. */
    private const val KEY_SETUP_VERSION_CODE = "setup_version_code"
    /** Detects reinstall when Android backup restores stale wizard prefs. */
    private const val KEY_FIRST_INSTALL_TIME = "first_install_time"

    /**
     * Clears wizard completion when the app was updated or reinstalled so merchants
     * see setup again after installing a new APK from the panel.
     */
    fun syncInstalledVersion(context: Context) {
        val versionCode = currentVersionCode(context)
        val installTime = currentFirstInstallTime(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val storedVersion = prefs.getInt(KEY_SETUP_VERSION_CODE, -1)
        val storedInstallTime = prefs.getLong(KEY_FIRST_INSTALL_TIME, -1L)

        val firstRun = storedVersion == -1
        val versionChanged = !firstRun && storedVersion != versionCode
        val reinstalled = storedInstallTime != -1L && storedInstallTime != installTime

        if (!firstRun && !versionChanged && !reinstalled) return

        prefs.edit()
            .putInt(KEY_SETUP_VERSION_CODE, versionCode)
            .putLong(KEY_FIRST_INSTALL_TIME, installTime)
            .putBoolean(KEY_WIZARD_COMPLETED, false)
            .apply()
    }

    private fun currentVersionCode(context: Context): Int {
        return runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionCode
        }.getOrDefault(0)
    }

    private fun currentFirstInstallTime(context: Context): Long {
        return runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).firstInstallTime
        }.getOrDefault(0L)
    }

    fun isWizardCompleted(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_WIZARD_COMPLETED, false)
    }

    fun setWizardCompleted(context: Context, completed: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WIZARD_COMPLETED, completed)
            .apply()
    }

    fun isStepCompleted(context: Context, stepId: String): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_STEP_PREFIX + stepId, false)
    }

    fun setStepCompleted(context: Context, stepId: String, completed: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_STEP_PREFIX + stepId, completed)
            .apply()
    }

    fun isTapToPayDeviceRegistered(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_TAP_TO_PAY_REGISTERED, false)
    }

    fun setTapToPayDeviceRegistered(context: Context, registered: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_TAP_TO_PAY_REGISTERED, registered)
            .apply()
    }

    fun reset(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
