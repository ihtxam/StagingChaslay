package com.rebornsense.printbridge.setup

import android.content.Context

object OemSetupPreferences {
    private const val PREFS = "reborn_print_bridge_oem_setup"
    private const val KEY_WIZARD_COMPLETED = "wizard_completed"
    private const val KEY_STEP_PREFIX = "step_"
    /** When this differs from the installed versionCode, the setup wizard runs again. */
    private const val KEY_SETUP_VERSION_CODE = "setup_version_code"

    /**
     * Clears wizard completion when the app was updated so merchants see setup again
     * after installing a new APK from the panel.
     */
    fun syncInstalledVersion(context: Context) {
        val versionCode = currentVersionCode(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val stored = prefs.getInt(KEY_SETUP_VERSION_CODE, -1)
        if (stored == versionCode) return
        prefs.edit()
            .putInt(KEY_SETUP_VERSION_CODE, versionCode)
            .putBoolean(KEY_WIZARD_COMPLETED, false)
            .apply()
    }

    private fun currentVersionCode(context: Context): Int {
        return runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionCode
        }.getOrDefault(0)
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

    fun reset(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
