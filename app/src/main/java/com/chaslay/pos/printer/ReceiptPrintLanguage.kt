package com.chaslay.pos.printer

import android.content.Context
import android.content.res.Configuration
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.ConfigurationCompat
import androidx.datastore.preferences.core.stringPreferencesKey
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.preferences.sessionDataStore
import com.chaslay.pos.domain.model.AppLanguage
import java.util.Locale
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val appLanguageKey = stringPreferencesKey("app_language")
private const val TAG = "ReceiptPrintLanguage"

/** Receipt / kitchen print language: session app language, then AppCompat locale, then business default. */
object ReceiptPrintLanguage {
    fun codeFor(context: Context, settings: BusinessSettingsEntity): String =
        resolve(context, settings.defaultLanguage)

    fun codeFor(context: Context, businessDefaultLanguage: String): String =
        resolve(context, businessDefaultLanguage)

    fun resolve(context: Context, businessDefaultLanguage: String): String {
        val appContext = context.applicationContext
        val sessionRaw = runBlocking {
            appContext.sessionDataStore.data.first()[appLanguageKey]
        }?.trim()?.takeIf { it.isNotEmpty() }
        if (sessionRaw != null) {
            val code = AppLanguage.fromCode(sessionRaw).code
            Log.d(TAG, "resolve: session app_language=$sessionRaw -> $code")
            return code
        }

        val appCompatTag = AppCompatDelegate.getApplicationLocales().let { locales ->
            if (locales.isEmpty) null else locales[0]?.toLanguageTag()
        }
        if (!appCompatTag.isNullOrBlank()) {
            val code = AppLanguage.fromCode(appCompatTag.substringBefore('-')).code
            Log.d(
                TAG,
                "resolve: session empty, AppCompat locale=$appCompatTag -> $code"
            )
            return code
        }

        val compatLocales = ConfigurationCompat.getLocales(appContext.resources.configuration)
        val configLang = compatLocales.get(0)?.language?.trim()
        if (!configLang.isNullOrEmpty()) {
            val code = AppLanguage.fromCode(configLang).code
            Log.d(
                TAG,
                "resolve: session empty, ConfigurationCompat locale=$configLang -> $code"
            )
            return code
        }

        val business = businessDefaultLanguage.trim().takeIf { it.isNotEmpty() }
        val code = AppLanguage.fromCode(business ?: AppLanguage.ENGLISH.code).code
        Log.d(
            TAG,
            "resolve: session empty, no app locale; businessDefault=${business ?: "en"} -> $code"
        )
        return code
    }

    fun labelsFor(context: Context, settings: BusinessSettingsEntity): ReceiptLabels =
        ReceiptLabels.forLanguage(codeFor(context, settings))

    /** [Context.getString] on the app context ignores AppCompat locales; use for receipt extras. */
    fun localizedContext(context: Context, languageCode: String): Context {
        val locale = Locale.forLanguageTag(languageCode)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}
