package com.rebornsense.printbridge

import android.content.Context
import android.os.UserManager

/**
 * Boot receivers are [android.content.pm.ApplicationInfo.FLAG_DIRECT_BOOT_AWARE].
 * Credential-encrypted SharedPreferences, filesDir, and Adyen init are illegal
 * until the user is unlocked — and WiFi is often still down in that window.
 * Touching CE storage then shows "Bridge Reborn has stopped".
 */
object BridgeUserUnlock {
    fun isCredentialStorageReady(context: Context): Boolean {
        return runCatching {
            val um = context.applicationContext.getSystemService(UserManager::class.java)
            um == null || um.isUserUnlocked
        }.getOrDefault(true)
    }
}
