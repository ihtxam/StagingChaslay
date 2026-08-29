package com.rebornsense.printbridge.setup

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import com.rebornsense.printbridge.R

object OemSettingsNavigator {
    fun isBatteryOptimizationDisabled(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(PowerManager::class.java) ?: return true
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun openBatteryOptimizationRequest(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        if (isBatteryOptimizationDisabled(context)) return true
        val packageUri = Uri.parse("package:${context.packageName}")
        val intents = listOf(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply { data = packageUri },
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        )
        return startFirstAvailable(context, intents, R.string.oem_setup_open_settings_failed)
    }

    fun openAutostartSettings(context: Context): Boolean {
        val intents = buildList {
            addAll(sunmiAutostartIntents())
            addAll(genericAutostartIntents())
            add(appDetailsIntent(context))
        }
        return startFirstAvailable(context, intents, R.string.oem_setup_open_settings_failed)
    }

    fun openBackgroundActivitySettings(context: Context): Boolean {
        val intents = listOf(
            appDetailsIntent(context),
            Intent(Settings.ACTION_APPLICATION_SETTINGS),
        )
        return startFirstAvailable(context, intents, R.string.oem_setup_open_settings_failed)
    }

    fun openAppDetails(context: Context): Boolean {
        return startFirstAvailable(
            context,
            listOf(appDetailsIntent(context)),
            R.string.oem_setup_open_settings_failed,
        )
    }

    private fun appDetailsIntent(context: Context): Intent {
        return Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private fun sunmiAutostartIntents(): List<Intent> {
        val components = listOf(
            ComponentName("com.sunmi.permcenter", "com.sunmi.permcenter.autostart.AutoStartActivity"),
            ComponentName("com.sunmi.permcenter", "com.sunmi.permcenter.autostart.AutoStartListActivity"),
            ComponentName("com.sunmi.permissioncontroller", "com.sunmi.permissioncontroller.autostart.AutoStartActivity"),
        )
        return components.map { component ->
            Intent().apply {
                this.component = component
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
    }

    private fun genericAutostartIntents(): List<Intent> {
        val components = listOf(
            ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
            ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
            ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
            ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
            ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
            ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
            ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
            ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
            ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
        )
        return components.map { component ->
            Intent().apply {
                this.component = component
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
    }

    private fun startFirstAvailable(context: Context, intents: List<Intent>, failureRes: Int): Boolean {
        for (intent in intents) {
            if (tryStart(context, intent)) return true
        }
        Toast.makeText(context, failureRes, Toast.LENGTH_LONG).show()
        return false
    }

    private fun tryStart(context: Context, intent: Intent): Boolean {
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
}
