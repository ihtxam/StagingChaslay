package com.rebornsense.printbridge.setup

import android.content.Context

object OemSetupPreferences {
    private const val PREFS = "reborn_print_bridge_oem_setup"
    private const val KEY_WIZARD_COMPLETED = "wizard_completed"
    private const val KEY_STEP_PREFIX = "step_"

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
