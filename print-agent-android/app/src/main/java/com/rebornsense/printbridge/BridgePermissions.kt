package com.rebornsense.printbridge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

object BridgePermissions {
    /** Android 13+ requires POST_NOTIFICATIONS before a foreground service can show its notification. */
    fun needsNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) != PackageManager.PERMISSION_GRANTED
    }

    fun hasNotificationPermission(context: Context): Boolean = !needsNotificationPermission(context)
}
