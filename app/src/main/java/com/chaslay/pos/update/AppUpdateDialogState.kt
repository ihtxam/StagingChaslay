package com.chaslay.pos.update

data class AppUpdateOffer(
    val versionName: String,
    val versionCode: Int,
    val apkUrl: String,
    val sizeBytes: Long? = null,
)

sealed interface AppUpdateDialogState {
    data class Offer(val offer: AppUpdateOffer) : AppUpdateDialogState

    data class Downloading(
        val offer: AppUpdateOffer,
        val bytesRead: Long,
        val contentLength: Long?,
    ) : AppUpdateDialogState

    data object InstallPermissionRequired : AppUpdateDialogState

    data class Error(val message: String) : AppUpdateDialogState
}
