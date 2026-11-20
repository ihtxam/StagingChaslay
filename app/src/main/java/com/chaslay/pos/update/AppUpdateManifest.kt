package com.chaslay.pos.update

import com.google.gson.annotations.SerializedName

/** Response from `GET /downloads/reborn-pos-android.json`. */
data class AppUpdateManifest(
    @SerializedName("version") val version: String? = null,
    @SerializedName("versionCode") val versionCode: Int? = null,
    @SerializedName("apkFile") val apkFile: String? = null,
    @SerializedName("downloadUrl") val downloadUrl: String? = null,
    val available: Boolean? = null,
)
