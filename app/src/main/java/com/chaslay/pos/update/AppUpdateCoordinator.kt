package com.chaslay.pos.update

import android.app.Activity
import android.content.Context
import com.chaslay.pos.BuildConfig
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

@Singleton
class AppUpdateCoordinator @Inject constructor(
    @ApplicationContext private val appContext: Context,
    @AppUpdateHttpClient private val http: OkHttpClient,
    private val gson: Gson,
    private val preferences: AppUpdatePreferences,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val _dialogState = MutableStateFlow<AppUpdateDialogState?>(null)
    val dialogState: StateFlow<AppUpdateDialogState?> = _dialogState.asStateFlow()

    private val _isChecking = MutableStateFlow(false)
    val isChecking: StateFlow<Boolean> = _isChecking.asStateFlow()

    private var pendingOffer: AppUpdateOffer? = null
    private var launchCheckDone = false

    fun checkForUpdate(manual: Boolean) {
        if (_isChecking.value) return
        if (!manual && launchCheckDone) return
        if (!manual) launchCheckDone = true
        scope.launch {
            _isChecking.value = true
            try {
                val manifest = fetchManifest() ?: run {
                    if (manual) {
                        _dialogState.value = AppUpdateDialogState.Error(
                            appContext.getString(com.chaslay.pos.R.string.app_update_check_failed),
                        )
                    }
                    return@launch
                }
                val remoteCode = manifest.versionCode
                val localCode = BuildConfig.VERSION_CODE
                if (remoteCode == null || remoteCode <= localCode) {
                    if (manual) {
                        _dialogState.value = AppUpdateDialogState.Error(
                            appContext.getString(com.chaslay.pos.R.string.app_update_none),
                        )
                    }
                    return@launch
                }
                if (!manual && remoteCode <= preferences.dismissedVersionCode()) return@launch
                val apkUrl = AppUpdateUrls.resolveApkUrl(manifest)
                if (apkUrl.isNullOrBlank()) {
                    if (manual) {
                        _dialogState.value = AppUpdateDialogState.Error(
                            appContext.getString(com.chaslay.pos.R.string.app_update_check_failed),
                        )
                    }
                    return@launch
                }
                val offer = AppUpdateOffer(
                    versionName = manifest.version?.trim().orEmpty().ifBlank { remoteCode.toString() },
                    versionCode = remoteCode,
                    apkUrl = apkUrl,
                )
                pendingOffer = offer
                _dialogState.value = AppUpdateDialogState.Offer(offer)
            } finally {
                _isChecking.value = false
            }
        }
    }

    fun dismissOffer() {
        val code = pendingOffer?.versionCode ?: return
        preferences.dismissVersionCode(code)
        pendingOffer = null
        _dialogState.value = null
    }

    fun dismissDialog() {
        _dialogState.value = null
    }

    fun startDownload(activity: Activity) {
        val offer = pendingOffer ?: (_dialogState.value as? AppUpdateDialogState.Offer)?.offer ?: return
        pendingOffer = offer
        if (!AppUpdateInstaller.canRequestPackageInstalls(activity)) {
            _dialogState.value = AppUpdateDialogState.InstallPermissionRequired
            return
        }
        scope.launch {
            _dialogState.value = AppUpdateDialogState.Downloading(offer, bytesRead = 0L, contentLength = null)
            val result = withContext(Dispatchers.IO) { downloadApk(offer) }
            result.fold(
                onSuccess = { file ->
                    AppUpdateInstaller.installApk(activity, file)
                    _dialogState.value = null
                },
                onFailure = { err ->
                    _dialogState.value = AppUpdateDialogState.Error(
                        err.message ?: appContext.getString(com.chaslay.pos.R.string.app_update_download_failed),
                    )
                },
            )
        }
    }

    fun retryAfterInstallPermission(activity: Activity) {
        if (AppUpdateInstaller.canRequestPackageInstalls(activity)) {
            startDownload(activity)
        }
    }

    fun openInstallPermissionSettings(activity: Activity) {
        AppUpdateInstaller.openUnknownSourcesSettings(activity)
    }

    private suspend fun fetchManifest(): AppUpdateManifest? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(AppUpdateUrls.manifestUrl())
            .header("Cache-Control", "no-cache")
            .get()
            .build()
        runCatching {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string().orEmpty()
                if (body.isBlank()) return@withContext null
                gson.fromJson(body, AppUpdateManifest::class.java)
            }
        }.getOrNull()
    }

    private fun downloadApk(offer: AppUpdateOffer): Result<File> = runCatching {
        val request = Request.Builder().url(offer.apkUrl).get().build()
        val dir = File(appContext.cacheDir, "app-updates").apply { mkdirs() }
        val dest = File(dir, "reborn-pos-android-${offer.versionCode}.apk")
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            val body = response.body ?: error("empty body")
            val total = body.contentLength().takeIf { it > 0L }
            body.byteStream().use { input ->
                dest.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var readTotal = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        output.write(buffer, 0, read)
                        readTotal += read
                        scope.launch {
                            val current = _dialogState.value
                            if (current is AppUpdateDialogState.Downloading &&
                                current.offer.versionCode == offer.versionCode
                            ) {
                                _dialogState.value = current.copy(bytesRead = readTotal, contentLength = total)
                            }
                        }
                    }
                }
            }
        }
        dest
    }
}
