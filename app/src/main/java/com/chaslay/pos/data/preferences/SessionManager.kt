package com.chaslay.pos.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.domain.model.PosPermission
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.domain.model.UserAccess
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    /** Bumped on each [saveSession]; background lock skips clear if login happened since onStop. */
    private val authEpoch = AtomicInteger(0)

    fun currentAuthEpoch(): Int = authEpoch.get()
    private val userIdKey = longPreferencesKey("user_id")
    private val userNameKey = stringPreferencesKey("user_name")
    private val userRoleKey = stringPreferencesKey("user_role")
    private val roleIdKey = longPreferencesKey("role_id")
    private val roleNameKey = stringPreferencesKey("role_name")
    private val permissionsKey = stringPreferencesKey("user_permissions")
    private val languageKey = stringPreferencesKey("app_language")
    private val themeModeKey = stringPreferencesKey("pos_theme_mode")
    private val kioskModeKey = booleanPreferencesKey("kiosk_fullscreen_mode")

    val currentUserId: Flow<Long?> = context.sessionDataStore.data.map { prefs ->
        prefs[userIdKey]
    }

    val currentUserName: Flow<String?> = context.sessionDataStore.data.map { prefs ->
        prefs[userNameKey]
    }

    @Deprecated("Use currentUserAccess")
    val currentUserRole: Flow<String?> = context.sessionDataStore.data.map { prefs ->
        prefs[roleNameKey] ?: prefs[userRoleKey]
    }

    val currentUserAccess: Flow<UserAccess?> = context.sessionDataStore.data.map { prefs ->
        val roleId = prefs[roleIdKey] ?: return@map null
        val roleName = prefs[roleNameKey] ?: prefs[userRoleKey] ?: return@map null
        val permissions = PosPermission.decode(prefs[permissionsKey])
        if (permissions.isEmpty()) return@map null
        UserAccess(roleId = roleId, roleName = roleName, permissions = permissions)
    }

    val appLanguage: Flow<AppLanguage> = context.sessionDataStore.data.map { prefs ->
        AppLanguage.fromCode(prefs[languageKey] ?: AppLanguage.ENGLISH.code)
    }

    val posThemeMode: Flow<PosThemeMode> = context.sessionDataStore.data.map { prefs ->
        PosThemeMode.fromName(prefs[themeModeKey])
    }

    val kioskFullscreenEnabled: Flow<Boolean> = context.sessionDataStore.data.map { prefs ->
        prefs[kioskModeKey] ?: true
    }

    suspend fun saveSession(userId: Long, userName: String, access: UserAccess) {
        authEpoch.incrementAndGet()
        context.sessionDataStore.edit { prefs ->
            prefs[userIdKey] = userId
            prefs[userNameKey] = userName
            prefs[roleIdKey] = access.roleId
            prefs[roleNameKey] = access.roleName
            prefs[userRoleKey] = access.roleName
            prefs[permissionsKey] = PosPermission.encode(access.permissions)
        }
    }

    /** Clears POS login only; keeps language, theme, and kiosk prefs. */
    suspend fun clearAuthSession() {
        clearAuthSessionInternal()
    }

    /**
     * Used when the app moves to background: avoids wiping a session saved after [onStop]
     * (re-login race that could crash or flash POS while composables tear down).
     */
    suspend fun clearAuthSessionIfStillEpoch(expectedEpoch: Int): Boolean {
        if (authEpoch.get() != expectedEpoch) return false
        clearAuthSessionInternal()
        return true
    }

    private suspend fun clearAuthSessionInternal() {
        context.sessionDataStore.edit { prefs ->
            prefs.remove(userIdKey)
            prefs.remove(userNameKey)
            prefs.remove(userRoleKey)
            prefs.remove(roleIdKey)
            prefs.remove(roleNameKey)
            prefs.remove(permissionsKey)
        }
    }

    suspend fun clearSession() {
        clearAuthSession()
    }

    suspend fun setLanguage(language: AppLanguage) {
        context.sessionDataStore.edit { prefs ->
            prefs[languageKey] = language.code
        }
    }

    suspend fun setPosThemeMode(mode: PosThemeMode) {
        context.sessionDataStore.edit { prefs ->
            prefs[themeModeKey] = mode.name
        }
    }

    suspend fun setKioskFullscreenEnabled(enabled: Boolean) {
        context.sessionDataStore.edit { prefs ->
            prefs[kioskModeKey] = enabled
        }
    }
}
