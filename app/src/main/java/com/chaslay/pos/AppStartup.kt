package com.chaslay.pos

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.datastore.preferences.core.stringPreferencesKey
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.preferences.sessionDataStore
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.payment.taptopay.TapToPayEngine
import com.chaslay.pos.printer.PrinterConnectionManager
import com.chaslay.pos.printer.UsbBootAttachGrace
import com.chaslay.pos.printer.UsbPrinterManager
import com.chaslay.pos.sync.BackgroundSyncScheduler
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val startupLanguageKey = stringPreferencesKey("app_language")

/** Heavy Application.onCreate work — kept out of [ChaslayPosApp] to shrink main-dex closure. */
@Singleton
class AppStartup @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val crashLogger: CrashLogger,
    private val printerConnectionManager: PrinterConnectionManager,
    private val usbPrinterManager: UsbPrinterManager,
    private val backgroundSyncScheduler: BackgroundSyncScheduler,
    private val tapToPayEngine: TapToPayEngine,
    private val sessionManager: SessionManager,
) {
    fun run() {
        runBlocking { sessionManager.clearAuthSession() }
        applySavedLocale()
        crashLogger.installGlobalHandler()
        crashLogger.flushPendingUploads()
        UsbBootAttachGrace.ensureBootAnchorIfUnset(appContext)
        printerConnectionManager.warmupOnStartup()
        usbPrinterManager.startMonitoring()
        backgroundSyncScheduler.schedule(appContext)
        tapToPayEngine.initialize(appContext as android.app.Application)
    }

    private fun applySavedLocale() {
        val languageCode = runBlocking {
            appContext.sessionDataStore.data.first()[startupLanguageKey]?.trim()?.takeIf { it.isNotEmpty() }
                ?: AppCompatDelegate.getApplicationLocales().let { locales ->
                    if (locales.isEmpty) null else locales[0]?.toLanguageTag()?.substringBefore('-')
                }
                ?: AppLanguage.ENGLISH.code
        }
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(languageCode))
        val persisted = runBlocking {
            appContext.sessionDataStore.data.first()[startupLanguageKey]?.trim()?.takeIf { it.isNotEmpty() }
        }
        if (persisted == null) {
            runBlocking {
                sessionManager.setLanguage(AppLanguage.fromCode(languageCode))
            }
        }
    }
}
