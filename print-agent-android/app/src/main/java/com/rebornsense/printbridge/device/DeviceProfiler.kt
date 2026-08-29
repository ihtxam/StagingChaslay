package com.rebornsense.printbridge.device

import android.os.Build

object DeviceProfiler {
    enum class Profile(val id: String, val displayName: String) {
        SUNMI("sunmi", "Sunmi"),
        FEITIAN("feitian", "Feitian"),
        GENERIC_CHINESE("generic-chinese", "Android tablet"),
        GENERIC_ANDROID("generic-android", "Android"),
    }

    fun detect(): Profile {
        val manufacturer = Build.MANUFACTURER.orEmpty().uppercase()
        val model = Build.MODEL.orEmpty().uppercase()
        return when {
            manufacturer.contains("SUNMI") -> Profile.SUNMI
            manufacturer.contains("FEITIAN") || model.contains("F310") -> Profile.FEITIAN
            isChineseOem(manufacturer) -> Profile.GENERIC_CHINESE
            else -> Profile.GENERIC_ANDROID
        }
    }

    /** Matches `/health.deviceProfile` values in BridgeHttpServer. */
    fun deviceProfileId(): String {
        val manufacturer = Build.MANUFACTURER.orEmpty().uppercase()
        val model = Build.MODEL.orEmpty().uppercase()
        return when {
            manufacturer.contains("SUNMI") && model.contains("D3") -> "sunmi-d3-mini"
            manufacturer.contains("SUNMI") && model.contains("D2") -> "sunmi-d2s-plus"
            manufacturer.contains("FEITIAN") && model.contains("F310") -> "feitian-f310a"
            else -> "generic-android"
        }
    }

    private fun isChineseOem(manufacturer: String): Boolean {
        val brands = listOf(
            "XIAOMI", "REDMI", "POCO", "OPPO", "REALME", "ONEPLUS", "VIVO", "IQOO",
            "HUAWEI", "HONOR", "MEIZU", "LENOVO", "ZTE", "COOLPAD", "TCL", "BLACKVIEW",
        )
        return brands.any { manufacturer.contains(it) }
    }
}
