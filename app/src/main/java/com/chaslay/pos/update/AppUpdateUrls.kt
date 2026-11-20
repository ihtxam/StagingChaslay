package com.chaslay.pos.update

import com.chaslay.pos.BuildConfig

object AppUpdateUrls {
    /** Production manifest: `GET https://app.rebornsense.com/downloads/reborn-pos-android.json` */
    fun manifestUrl(): String {
        val override = BuildConfig.APP_UPDATE_MANIFEST_URL.trim()
        if (override.isNotEmpty()) return override
        val base = BuildConfig.LICENSE_API_BASE_URL.trim().trimEnd('/')
        return "$base/downloads/reborn-pos-android.json"
    }

    fun resolveApkUrl(manifest: AppUpdateManifest): String? {
        val direct = manifest.downloadUrl?.trim().orEmpty()
        if (direct.isNotEmpty()) {
            return if (direct.startsWith("http")) direct else {
                val base = BuildConfig.LICENSE_API_BASE_URL.trim().trimEnd('/')
                if (direct.startsWith("/")) "$base$direct" else "$base/$direct"
            }
        }
        val file = manifest.apkFile?.trim().orEmpty().ifBlank { DEFAULT_APK_FILE }
        val base = BuildConfig.LICENSE_API_BASE_URL.trim().trimEnd('/')
        return "$base/downloads/$file"
    }

    private const val DEFAULT_APK_FILE = "reborn-pos-android.apk"
}
