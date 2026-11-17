package com.chaslay.pos.update

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdatePreferences @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Remote [versionCode] dismissed via "Later" until a newer build is published. */
    fun dismissedVersionCode(): Int = prefs.getInt(KEY_DISMISSED_CODE, 0)

    fun dismissVersionCode(versionCode: Int) {
        prefs.edit().putInt(KEY_DISMISSED_CODE, versionCode).apply()
    }

    companion object {
        private const val PREFS = "app_update"
        private const val KEY_DISMISSED_CODE = "dismissed_version_code"
    }
}
