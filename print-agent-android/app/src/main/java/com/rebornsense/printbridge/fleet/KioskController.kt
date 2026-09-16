package com.rebornsense.printbridge.fleet

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.setup.OemSetupPreferences

object KioskController {
    private const val TAG = "KioskController"

    private val BROWSER_CANDIDATES = listOf(
        "com.android.chrome",
        "com.chrome.beta",
        "com.android.browser",
        "com.sunmi.browser",
        "org.mozilla.firefox",
    )

    fun adminComponent(context: Context): ComponentName {
        return ComponentName(context, PrintBridgeDeviceAdminReceiver::class.java)
    }

    fun isDeviceOwner(context: Context): Boolean {
        val dpm = context.getSystemService(DevicePolicyManager::class.java) ?: return false
        return dpm.isDeviceOwnerApp(context.packageName)
    }

    fun isDeviceAdmin(context: Context): Boolean {
        val dpm = context.getSystemService(DevicePolicyManager::class.java) ?: return false
        return dpm.isAdminActive(adminComponent(context))
    }

    fun isKioskActive(context: Context): Boolean {
        if (!FleetPreferences.isKioskEnabled(context)) return false
        val activityManager = context.getSystemService(ActivityManager::class.java) ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            activityManager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        } else {
            @Suppress("DEPRECATION")
            activityManager.isInLockTaskMode
        }
    }

    fun resolveWebPosUrl(context: Context): String {
        FleetPreferences.getPosUrlOverride(context)?.let { return it }
        val stored = OemSetupPreferences.getWebPosOrigin(context)
        val host = stored?.trimEnd('/') ?: "https://app.chaslay.com"
        return "$host/merchant/pos"
    }

    fun resolveBrowserPackage(context: Context): String? {
        FleetPreferences.getBrowserPackage(context)?.let { pkg ->
            if (isPackageInstalled(context, pkg)) return pkg
        }
        return BROWSER_CANDIDATES.firstOrNull { isPackageInstalled(context, it) }
    }

    fun applyDeviceOwnerPolicies(context: Context) {
        if (!isDeviceOwner(context)) return
        val appContext = context.applicationContext
        val dpm = appContext.getSystemService(DevicePolicyManager::class.java) ?: return
        val admin = adminComponent(appContext)
        runCatching {
            val packages = lockTaskPackages(appContext)
            dpm.setLockTaskPackages(admin, packages)
            Log.i(TAG, "Lock task packages: ${packages.joinToString()}")
        }.onFailure { Log.w(TAG, "setLockTaskPackages failed", it) }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            runCatching { dpm.setStatusBarDisabled(admin, true) }
                .onFailure { Log.w(TAG, "setStatusBarDisabled failed", it) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            runCatching { dpm.setKeyguardDisabled(admin, false) }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            runCatching {
                dpm.setPermissionGrantState(
                    admin,
                    appContext.packageName,
                    android.Manifest.permission.POST_NOTIFICATIONS,
                    DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
                )
            }.onFailure { Log.w(TAG, "notification grant failed", it) }
        }
        PrinterPreferencesCompat.ensureAutoStart(appContext)
    }

    fun enableKiosk(context: Context) {
        val appContext = context.applicationContext
        FleetPreferences.setKioskEnabled(appContext, true)
        applyDeviceOwnerPolicies(appContext)
        PrintBridgeLauncher.ensureRunning(appContext)
    }

    fun disableKiosk(context: Context) {
        val appContext = context.applicationContext
        FleetPreferences.setKioskEnabled(appContext, false)
        stopLockTaskIfActive(appContext)
    }

    fun launchKioskShell(context: Context) {
        val appContext = context.applicationContext
        if (!FleetPreferences.isKioskEnabled(appContext)) return
        PrintBridgeLauncher.ensureRunning(appContext)
        applyDeviceOwnerPolicies(appContext)
        val intent = Intent(appContext, FleetKioskLauncherActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        appContext.startActivity(intent)
    }

    fun openWebPosInBrowser(context: Context) {
        val url = resolveWebPosUrl(context)
        val browser = resolveBrowserPackage(context) ?: run {
            Log.w(TAG, "No browser found for kiosk URL: $url")
            return
        }
        FleetPreferences.setBrowserPackage(context, browser)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            setPackage(browser)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addCategory(Intent.CATEGORY_BROWSABLE)
        }
        context.startActivity(intent)
    }

    fun startLockTask(activity: Activity) {
        if (!isDeviceOwner(activity)) return
        applyDeviceOwnerPolicies(activity)
        runCatching { activity.startLockTask() }
            .onFailure { Log.w(TAG, "startLockTask failed", it) }
    }

    fun stopLockTaskIfActive(context: Context) {
        if (context !is Activity) return
        if (!isKioskActive(context)) return
        runCatching { context.stopLockTask() }
            .onFailure { Log.w(TAG, "stopLockTask failed", it) }
    }

    fun stopLockTask(activity: Activity) {
        runCatching { activity.stopLockTask() }
            .onFailure { Log.w(TAG, "stopLockTask failed", it) }
    }

    private fun lockTaskPackages(context: Context): Array<String> {
        val packages = linkedSetOf(context.packageName)
        resolveBrowserPackage(context)?.let { packages.add(it) }
        return packages.toTypedArray()
    }

    private fun isPackageInstalled(context: Context, packageName: String): Boolean {
        return runCatching {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        }.getOrDefault(false)
    }

    /** Keeps auto-start on without importing print preferences into fleet module. */
    private object PrinterPreferencesCompat {
        fun ensureAutoStart(context: Context) {
            com.rebornsense.printbridge.print.PrinterPreferences.setAutoStartEnabled(context, true)
        }
    }
}
