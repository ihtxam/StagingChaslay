package com.chaslay.pos.ui.settings

import androidx.appcompat.app.AppCompatDelegate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.data.repository.TransactionRepository
import android.content.Intent
import androidx.core.content.FileProvider
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.debug.CrashLogEntry
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.debug.PosDiagnosticLogger
import com.chaslay.pos.debug.RemoteDiagnosticUploader
import com.chaslay.pos.data.repository.AuthRepository
import com.chaslay.pos.domain.model.DashboardAuthResult
import com.chaslay.pos.domain.model.AppLanguage
import androidx.annotation.StringRes
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.ExpressPayPlacement
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.CourseSendMode
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.PosCompactLayoutPreference
import com.chaslay.pos.domain.model.PosMenuDesign
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.domain.model.CategoryPrintSetting
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.SupportedCurrency
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.PrinterUserMessages
import com.chaslay.pos.printer.DiscoveredPrinter
import com.chaslay.pos.printer.SunmiInternalPrinter
import com.chaslay.pos.printer.UsbPrinterDevice
import com.chaslay.pos.printer.UsbPrinterManager
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import android.net.Uri
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.chaslay.pos.sync.FloorLanServer
import com.chaslay.pos.sync.NetworkAddress
import com.chaslay.pos.sync.terminalSyncPayloadChanged
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import javax.inject.Inject

private const val PRINTER_REACHABILITY_DEBOUNCE_MS = 1_500L

data class PrinterLinkProduct(val id: Long, val name: String)
data class PrinterLinkCategory(val id: Long, val name: String, val products: List<PrinterLinkProduct>)

/** Read-only summary for Settings → General (staff PIN session vs cloud merchant login). */
data class PosSessionDisplay(
    val staffName: String? = null,
    val staffEmail: String? = null,
    val staffRole: String? = null,
    val merchantAccountEmail: String? = null,
    val merchantShopName: String? = null,
    val merchantLinked: Boolean = false,
    val dashboardSignedIn: Boolean = false,
    val isSyncedStaffAccount: Boolean = false,
)

enum class SettingsSection(@StringRes val titleRes: Int) {
    GENERAL(R.string.settings_section_general),
    TABLES(R.string.settings_section_tables),
    VAT(R.string.settings_section_vat),
    PAYMENTS(R.string.settings_section_payments),
    PRINTERS(R.string.settings_section_printers),
    SCALE(R.string.settings_section_scale),
    RECEIPTS(R.string.settings_section_receipts),
    FLOOR_DEVICES(R.string.settings_section_floor_devices),
    USERS_ACCOUNTS(R.string.settings_section_users),
    APPEARANCE(R.string.settings_section_appearance),
    LICENSE(R.string.settings_section_license),
    UPDATE(R.string.settings_section_update),
    DIAGNOSTICS(R.string.settings_section_diagnostics);

    companion object {
        fun visibleNavSections(
            canManageUsers: Boolean,
            restaurantMode: Boolean,
        ): List<SettingsSection> = entries.filter { section ->
            when (section) {
                SettingsSection.USERS_ACCOUNTS -> canManageUsers
                SettingsSection.TABLES -> restaurantMode
                SettingsSection.FLOOR_DEVICES ->
                    restaurantMode && com.chaslay.pos.PosBuildFeatures.FLOOR_AND_WAITERS_NAV_VISIBLE
                SettingsSection.DIAGNOSTICS -> false
                else -> true
            }
        }
    }
}

/** When not in restaurant mode, Tables and Floor & Waiters are hidden — fall back to General. */
private fun coerceRestaurantOnlySection(posMode: PosMode, selected: SettingsSection): SettingsSection {
    if (!com.chaslay.pos.PosBuildFeatures.FLOOR_AND_WAITERS_NAV_VISIBLE &&
        selected == SettingsSection.FLOOR_DEVICES
    ) {
        return SettingsSection.GENERAL
    }
    return if (posMode != PosMode.RESTAURANT &&
        (selected == SettingsSection.TABLES || selected == SettingsSection.FLOOR_DEVICES)
    ) {
        SettingsSection.GENERAL
    } else {
        selected
    }
}

data class SettingsUiState(
    val businessName: String = "",
    val vatNumber: String = "",
    val address: String = "",
    val phone: String = "",
    val email: String = "",
    val website: String = "",
    val defaultCurrency: String = "CHF",
    val currencySymbol: String = "CHF",
    val language: AppLanguage = AppLanguage.ENGLISH,
    val tapToPayEnabled: Boolean = false,
    val adyenTerminalEnabled: Boolean = false,
    val adyenTerminalId: String = "",
    val adyenApiKey: String = "",
    val adyenClientId: String = "",
    val adyenMerchantAccount: String = "",
    val adyenLiveEnvironment: Boolean = false,
    val adyenLiveRegion: String = "EU",
    val adyenUseLegacyEndpoint: Boolean = false,
    val isTestingAdyen: Boolean = false,
    val tapToPayReadiness: com.chaslay.pos.payment.taptopay.TapToPayReadiness =
        com.chaslay.pos.payment.taptopay.TapToPayReadiness.NO_SDK,
    val isActivatingTapToPay: Boolean = false,
    val roundingStep: String = "0.05",
    val cashEnabled: Boolean = true,
    val cardEnabled: Boolean = true,
    val terminalEnabled: Boolean = true,
    val expressEnabled: Boolean = true,
    val expressPayPlacement: ExpressPayPlacement = ExpressPayPlacement.PRODUCT_GRID,
    val afterSaleGoToOrders: Boolean = false,
    val retailCashTenderDialogEnabled: Boolean = true,
    val giftCardsEnabled: Boolean = false,
    val invoiceEnabled: Boolean = true,
    val paymentMethodsManagedByCloud: Boolean = false,
    val printerPrintReceipts: Boolean = true,
    val printerPrintReports: Boolean = true,
    val printerPrintKitchen: Boolean = false,
    val kitchenPrinterPrintKitchen: Boolean = true,
    val dineInVatRate: String = "8.1",
    val takeawayVatRate: String = "2.6",
    val vatIncludedInPrice: Boolean = false,
    val newTableName: String = "",
    val tables: List<String> = emptyList(),
    val printers: List<DiscoveredPrinter> = emptyList(),
    val networkPrinters: List<DiscoveredPrinter> = emptyList(),
    /** In Add Printer dialog — not cleared by [clearMessage] toast handler. */
    val printerDiscoveryMessage: String? = null,
    val isDiscoveryScanBusy: Boolean = false,
    val selectedPrinter: DiscoveredPrinter? = null,
    val selectedKitchenPrinter: DiscoveredPrinter? = null,
    val receiptHeader: String = "",
    val receiptFooter: String = "",
    val kitchenTicketHeader: String = "",
    val kitchenTicketFooter: String = "",
    val receiptShowVatTable: Boolean = true,
    val receiptShowStaffLine: Boolean = true,
    val receiptShowQrCode: Boolean = true,
    val receiptDeliveryDirectionsQr: Boolean = true,
    val adyenReceiptDigitalOnly: Boolean = false,
    val autoPrintReceipt: Boolean = true,
    val autoPrintKitchen: Boolean = true,
    val kitchenLargeItemText: Boolean = true,
    val kitchenLargeHeaderText: Boolean = true,
    val kitchenItemTextScale: Int = 2,
    val kitchenHeaderTextScale: Int = 2,
    val logoUri: String? = null,
    val receiptTemplateName: String = "Default",
    val categoryPrintSettings: List<CategoryPrintSetting> = emptyList(),
    val discountPresets: List<com.chaslay.pos.domain.model.DiscountPreset> = emptyList(),
    val newPresetName: String = "",
    val newPresetPercent: String = "",
    val savedPrinters: List<com.chaslay.pos.data.local.entity.PrinterConfigEntity> = emptyList(),
    /** Live reachability keyed by [SettingsViewModel.printerReachabilityKey]. */
    val printerReachability: Map<String, Boolean> = emptyMap(),
    val isProbingPrinters: Boolean = false,
    val showAddPrinterDialog: Boolean = false,
    val editingPrinter: com.chaslay.pos.data.local.entity.PrinterConfigEntity? = null,
    val linkCategories: List<PrinterLinkCategory> = emptyList(),
    val usbDevices: List<UsbPrinterDevice> = emptyList(),
    val scaleEnabled: Boolean = false,
    val scaleUsbAddress: String? = null,
    val scaleDevices: List<com.chaslay.pos.scale.ScaleUsbDevice> = emptyList(),
    val scaleTestReading: String? = null,
    /** Saved scale USB device is currently enumerated on the bus. */
    val scaleUsbDeviceAttached: Boolean = false,
    /** [android.hardware.usb.UsbManager.hasPermission] for [scaleUsbAddress]. */
    val scaleUsbHasPermission: Boolean = false,
    /** Live serial probe result for [scaleUsbAddress]; null until first probe completes. */
    val scaleReachability: Boolean? = null,
    val isProbingScale: Boolean = false,
    val scaleLastProbeAtMs: Long? = null,
    val message: String? = null,
    val isMenuSyncing: Boolean = false,
    val syncBusinessInfo: Boolean = true,
    val selectedSection: SettingsSection = SettingsSection.GENERAL,
    val posThemeMode: PosThemeMode = PosThemeMode.LIGHT,
    val kioskFullscreenEnabled: Boolean = true,
    val posDisplayScale: Float = 1f,
    val posTextScale: Float = 1f,
    val posMenuDesign: PosMenuDesign = PosMenuDesign.CLASSIC,
    val posCompactLayoutPreference: PosCompactLayoutPreference = PosCompactLayoutPreference.AUTO,
    val crashLogs: List<CrashLogEntry> = emptyList(),
    val selectedCrashLog: String? = null,
    val crashLogContent: String = "",
    val isPrinterBusy: Boolean = false,
    val posMode: PosMode = PosMode.RESTAURANT,
    val coursesEnabled: Boolean = false,
    val courseSendMode: CourseSendMode = CourseSendMode.FIRE_PER_COURSE,
    val tablesEnabled: Boolean = true,
    val retailDineInEnabled: Boolean = false,
    val retailTakeawayEnabled: Boolean = false,
    val retailDeliveryEnabled: Boolean = false,
    val retailWeighedCustomEntryEnabled: Boolean = false,
    val restaurantWeighedCustomEntryEnabled: Boolean = false,
    val reservationsEnabled: Boolean = false,
    val reservationsToggleSaving: Boolean = false,
    val merchantCloudLinked: Boolean = false,
    val requireTableForDineIn: Boolean = true,
    val openHour: String = "10",
    val openMinute: String = "0",
    val closeHour: String = "22",
    val closeMinute: String = "0",
    val trackCoversFromSeatingPlan: Boolean = false,
    val floorSyncEnabled: Boolean = false,
    val floorDeviceRole: FloorDeviceRole = FloorDeviceRole.STANDARD,
    val floorConnectionMode: FloorConnectionMode = FloorConnectionMode.AUTO,
    val mainPosLanUrl: String = "",
    val localLanUrl: String? = null,
    val isTestingMainPos: Boolean = false,
    val isDiscoveringMainPos: Boolean = false,
    val showCloudLoginDialog: Boolean = false,
    val cloudLoginEmail: String = "",
    val cloudLoginPassword: String = "",
    val isCloudLoggingIn: Boolean = false,
    val cloudLoginError: String? = null,
    /** When set, POS mode follows merchant panel sync (retail vs restaurant). */
    val posModeManagedByCloud: Boolean = false,
    val posSession: PosSessionDisplay = PosSessionDisplay(),
    /** Company / publisher blurb from superadmin (GET /api/merchant/platform-about via sync bootstrap). */
    val platformAboutHtml: String = "",
    val diagnosticsLastUploadLabel: String = "",
    val diagnosticsUploadInProgress: Boolean = false,
    val diagnosticsSessionPreview: String = "",
    val diagnosticsApiHostLabel: String = "",
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val settingsRepository: SettingsRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val productRepository: ProductRepository,
    private val transactionRepository: TransactionRepository,
    private val heldOrderRepository: com.chaslay.pos.data.repository.HeldOrderRepository,
    private val sessionManager: SessionManager,
    private val printerService: BluetoothPrinterService,
    private val usbPrinterManager: UsbPrinterManager,
    private val crashLogger: CrashLogger,
    private val remoteDiagnosticUploader: RemoteDiagnosticUploader,
    private val posDiagnosticLogger: PosDiagnosticLogger,
    private val adyenTerminalService: com.chaslay.pos.payment.AdyenTerminalService,
    private val scaleService: com.chaslay.pos.scale.AclasScaleService,
    private val floorSyncRepository: com.chaslay.pos.sync.FloorSyncRepository,
    private val terminalSyncRepository: com.chaslay.pos.sync.TerminalSyncRepository,
    private val syncService: com.chaslay.pos.sync.SyncService,
    private val menuSyncRepository: com.chaslay.pos.sync.MenuSyncRepository,
    private val reservationSyncRepository: com.chaslay.pos.sync.ReservationSyncRepository,
    private val syncApiKeyStore: com.chaslay.pos.data.preferences.SyncApiKeyStore,
    private val syncPreferences: com.chaslay.pos.data.preferences.SyncPreferences,
    private val authRepository: AuthRepository,
    private val tapToPayEngine: com.chaslay.pos.payment.taptopay.TapToPayEngine,
    private val appUpdateCoordinator: com.chaslay.pos.update.AppUpdateCoordinator,
) : ViewModel() {

    val appUpdateChecking = appUpdateCoordinator.isChecking

    fun checkForAppUpdate() {
        appUpdateCoordinator.checkForUpdate(manual = true)
    }

    private val _launchOnlineSettingsIntent = Channel<Intent>(Channel.BUFFERED)
    val launchOnlineSettingsIntent: Flow<Intent> = _launchOnlineSettingsIntent.receiveAsFlow()

    private val _shareDiagnosticsIntent = Channel<Intent>(Channel.BUFFERED)
    val shareDiagnosticsIntent: Flow<Intent> = _shareDiagnosticsIntent.receiveAsFlow()

    private var currentSettings = BusinessSettingsEntity()
    private var printerReachabilityRefreshJob: Job? = null
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            var settings = settingsRepository.getSettings()
            val rawVat = settings.vatIncludedInPrice
            val localVat = com.chaslay.pos.util.PosLocalPrefs.applyVatIncludedIfUserSet(
                appContext,
                rawVat
            )
            if (localVat != rawVat) {
                settings = settings.copy(vatIncludedInPrice = localVat)
                settingsRepository.saveSettings(settings)
            }
            val cloudMerchant = !syncPreferences.getMerchantId().isNullOrBlank()
            if (cloudMerchant) {
                runCatching { terminalSyncRepository.syncTerminals() }
                settings = settingsRepository.getSettings()
            }
            currentSettings = settings
            val sessionLanguage = sessionManager.appLanguage.first()
            val settingsLanguage = AppLanguage.fromCode(settings.defaultLanguage)
            val language = sessionLanguage.takeIf { it != AppLanguage.ENGLISH } ?: settingsLanguage
            if (language != sessionLanguage) {
                sessionManager.setLanguage(language)
            }
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.code))
            val themeMode = sessionManager.posThemeMode.first()
            val kioskFullscreen = sessionManager.kioskFullscreenEnabled.first()
            val displayScale = sessionManager.posDisplayScale.first()
            val textScale = sessionManager.posTextScale.first()
            val menuDesign = sessionManager.posMenuDesign.first()
            val compactLayoutPreference = sessionManager.posCompactLayoutPreference.first()
            val syncBusinessInfo = syncPreferences.isSyncBusinessInfoEnabled()
            val categories = productRepository.getAllCategories()
            val posSession = loadPosSessionDisplay(settings.businessName)
            _uiState.update {
                it.copy(
                    posSession = posSession,
                    businessName = settings.businessName,
                    posThemeMode = themeMode,
                    kioskFullscreenEnabled = kioskFullscreen,
                    posDisplayScale = displayScale,
                    posTextScale = textScale,
                    posMenuDesign = menuDesign,
                    posCompactLayoutPreference = compactLayoutPreference,
                    vatNumber = settings.vatNumber,
                    address = settings.address,
                    phone = settings.phone,
                    email = settings.email,
                    website = settings.website,
                    defaultCurrency = settings.defaultCurrency,
                    currencySymbol = settings.currencySymbol,
                    language = language,
                    tapToPayEnabled = settings.tapToPayEnabled,
                    adyenTerminalEnabled = settings.adyenTerminalEnabled,
                    adyenTerminalId = settings.adyenTerminalId,
                    adyenApiKey = settings.adyenApiKey,
                    adyenClientId = settings.adyenClientId,
                    adyenMerchantAccount = settings.adyenMerchantAccount,
                    adyenLiveEnvironment = settings.adyenLiveEnvironment,
                    adyenLiveRegion = settings.adyenLiveRegion,
                    adyenUseLegacyEndpoint = settings.adyenUseLegacyEndpoint,
                    roundingStep = settings.roundingStep.takeIf { it > 0.0 }?.toString() ?: "0.05",
                    openHour = settings.openHour.toString(),
                    openMinute = settings.openMinute.toString(),
                    closeHour = settings.closeHour.toString(),
                    closeMinute = settings.closeMinute.toString(),
                    cashEnabled = settings.cashEnabled,
                    cardEnabled = settings.cardEnabled,
                    terminalEnabled = settings.terminalEnabled,
                    expressEnabled = settings.expressEnabled,
                    expressPayPlacement = ExpressPayPlacement.fromCheckoutValue(settings.expressPayPlacement),
                    afterSaleGoToOrders = com.chaslay.pos.util.PosLocalPrefs.readAfterSaleGoToOrders(appContext),
                    retailCashTenderDialogEnabled = settings.retailCashTenderDialogEnabled,
                    giftCardsEnabled = settings.giftCardsEnabled,
                    invoiceEnabled = settings.invoiceEnabled,
                    paymentMethodsManagedByCloud = settings.paymentMethodsManagedByCloud,
                    printerPrintReceipts = settings.printerPrintReceipts,
                    printerPrintReports = settings.printerPrintReports,
                    printerPrintKitchen = settings.printerPrintKitchen,
                    kitchenPrinterPrintKitchen = settings.kitchenPrinterPrintKitchen,
                    dineInVatRate = settings.dineInVatRate.toString(),
                    takeawayVatRate = settings.takeawayVatRate.toString(),
                    vatIncludedInPrice = settings.vatIncludedInPrice,
                    receiptHeader = settings.receiptHeader,
                    receiptFooter = settings.receiptFooter,
                    kitchenTicketHeader = settings.kitchenTicketHeader,
                    kitchenTicketFooter = settings.kitchenTicketFooter,
                    receiptShowVatTable = settings.receiptShowVatTable,
                    receiptShowStaffLine = settings.receiptShowStaffLine,
                    receiptShowQrCode = settings.receiptShowQrCode,
                    receiptDeliveryDirectionsQr = settings.receiptDeliveryDirectionsQr,
                    adyenReceiptDigitalOnly = settings.adyenReceiptDigitalOnly,
                    autoPrintReceipt = settings.autoPrintReceipt,
                    autoPrintKitchen = settings.autoPrintKitchen,
                    kitchenLargeItemText = settings.kitchenLargeItemText,
                    kitchenLargeHeaderText = settings.kitchenLargeHeaderText,
                    kitchenItemTextScale = settings.kitchenItemTextScale.coerceIn(1, 3),
                    kitchenHeaderTextScale = settings.kitchenHeaderTextScale.coerceIn(1, 3),
                    logoUri = settings.logoUri,
                    receiptTemplateName = settings.receiptTemplateName,
                    posMode = settings.posMode,
                    selectedSection = coerceRestaurantOnlySection(settings.posMode, it.selectedSection),
                    posModeManagedByCloud = cloudMerchant || settings.paymentMethodsManagedByCloud,
                    coursesEnabled = settings.coursesEnabled,
                    courseSendMode = CourseSendMode.fromKey(settings.courseSendMode),
                    tablesEnabled = settings.tablesEnabled,
                    retailDineInEnabled = settings.retailDineInEnabled,
                    retailTakeawayEnabled = settings.retailTakeawayEnabled,
                    retailDeliveryEnabled = settings.retailDeliveryEnabled,
                    retailWeighedCustomEntryEnabled = settings.retailWeighedCustomEntryEnabled,
                    restaurantWeighedCustomEntryEnabled = settings.restaurantWeighedCustomEntryEnabled,
                    reservationsEnabled = settings.reservationsEnabled,
                    merchantCloudLinked = syncApiKeyStore.hasKey(),
                    requireTableForDineIn = settings.requireTableForDineIn,
                    trackCoversFromSeatingPlan = settings.trackCoversFromSeatingPlan,
                    floorSyncEnabled = settings.floorSyncEnabled,
                    floorDeviceRole = FloorDeviceRole.fromApi(settings.floorDeviceRole),
                    floorConnectionMode = FloorConnectionMode.fromApi(settings.floorConnectionMode),
                    mainPosLanUrl = settings.mainPosLanUrl,
                    localLanUrl = NetworkAddress.localLanUrl(FloorLanServer.PORT),
                    scaleEnabled = settings.scaleEnabled,
                    scaleUsbAddress = settings.scaleUsbAddress,
                    syncBusinessInfo = syncBusinessInfo,
                    selectedPrinter = resolvePrinter(settings.printerMacAddress, settings.printerName),
                    selectedKitchenPrinter = resolvePrinter(
                        settings.kitchenPrinterMacAddress,
                        settings.kitchenPrinterName
                    ) ?: BluetoothPrinterService.SIMULATED_PRINTER,
                    printers = listOf(BluetoothPrinterService.SIMULATED_PRINTER),
                    categoryPrintSettings = categories.map { c ->
                        CategoryPrintSetting(c.id, c.name, c.printTarget)
                    },
                    platformAboutHtml = settings.platformAboutHtml.orEmpty(),
                )
            }
            loadTables()
            loadDiscountPresets()
            loadSavedPrinters()
            syncMonitoredScaleUsbAddress()
            refreshScaleConnectionState()
            loadLinkCategories()
            refreshCrashLogs()
        }
    }

    private fun loadLinkCategories() {
        viewModelScope.launch {
            val categories = productRepository.getAllCategories()
            val products = productRepository.getAllProducts()
            val linkCategories = categories.map { category ->
                PrinterLinkCategory(
                    id = category.id,
                    name = category.name,
                    products = products.filter { it.categoryId == category.id }
                        .map { PrinterLinkProduct(it.id, it.name) }
                )
            }
            _uiState.update { it.copy(linkCategories = linkCategories) }
        }
    }

    fun selectSection(section: SettingsSection) {
        val resolved = coerceRestaurantOnlySection(_uiState.value.posMode, section)
        _uiState.update { it.copy(selectedSection = resolved, message = null) }
        if (resolved == SettingsSection.SCALE) {
            refreshScaleConnectionState()
            usbPrinterManager.requestMonitoredScalePermissionFromSettings(_uiState.value.scaleUsbAddress) { granted ->
                if (granted) refreshScaleConnectionState()
            }
        }
        if (resolved == SettingsSection.LICENSE) {
            refreshDiagnosticsPanel()
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    /**
     * Opens merchant dashboard Settings in a WebView when online.
     * Local Room settings remain the offline source of truth; [SyncService] pulls on reconnect.
     */
    fun openOnlineSettings() {
        viewModelScope.launch {
            if (!OnlineSettingsActivity.isOnline(appContext)) {
                _uiState.update { it.copy(message = appContext.getString(R.string.online_settings_offline)) }
                return@launch
            }
            val token = syncPreferences.getDashboardToken()
            val userJson = syncPreferences.getDashboardUserJson()
            if (token.isNullOrBlank() || userJson.isNullOrBlank()) {
                _uiState.update {
                    it.copy(
                        showCloudLoginDialog = true,
                        cloudLoginError = null,
                        message = null
                    )
                }
                return@launch
            }
            launchOnlineSettingsScreen()
        }
    }

    fun dismissCloudLoginDialog() {
        _uiState.update {
            it.copy(
                showCloudLoginDialog = false,
                cloudLoginEmail = "",
                cloudLoginPassword = "",
                cloudLoginError = null,
                isCloudLoggingIn = false
            )
        }
    }

    fun updateCloudLoginEmail(value: String) {
        _uiState.update { it.copy(cloudLoginEmail = value, cloudLoginError = null) }
    }

    fun updateCloudLoginPassword(value: String) {
        _uiState.update { it.copy(cloudLoginPassword = value, cloudLoginError = null) }
    }

    fun submitCloudLoginForOnlineSettings() {
        val email = _uiState.value.cloudLoginEmail.trim()
        val password = _uiState.value.cloudLoginPassword
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(cloudLoginError = appContext.getString(R.string.online_settings_login_required)) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isCloudLoggingIn = true, cloudLoginError = null) }
            when (val result = authRepository.authenticateDashboard(email, password)) {
                is DashboardAuthResult.Success -> {
                    _uiState.update {
                        it.copy(
                            showCloudLoginDialog = false,
                            cloudLoginEmail = "",
                            cloudLoginPassword = "",
                            isCloudLoggingIn = false,
                            cloudLoginError = null
                        )
                    }
                    launchOnlineSettingsScreen()
                }
                is DashboardAuthResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isCloudLoggingIn = false,
                            cloudLoginError = result.message
                        )
                    }
                }
            }
        }
    }

    private suspend fun launchOnlineSettingsScreen() {
        runCatching { syncService.syncAll(force = true) }
        val token = syncPreferences.getDashboardToken().orEmpty()
        val userJson = syncPreferences.getDashboardUserJson().orEmpty()
        if (token.isBlank() || userJson.isBlank()) {
            _uiState.update {
                it.copy(
                    showCloudLoginDialog = true,
                    cloudLoginError = appContext.getString(R.string.online_settings_need_login)
                )
            }
            return
        }
        val intent = OnlineSettingsActivity.createIntent(
            context = appContext,
            token = token,
            userJson = userJson,
            dashboardUrl = syncPreferences.getDashboardUrl()
        )
        _launchOnlineSettingsIntent.send(intent)
        _uiState.update { it.copy(message = null) }
    }

    fun updatePosThemeMode(mode: PosThemeMode) {
        _uiState.update { it.copy(posThemeMode = mode) }
        viewModelScope.launch { sessionManager.setPosThemeMode(mode) }
    }

    fun updateKioskFullscreenEnabled(enabled: Boolean) {
        _uiState.update { it.copy(kioskFullscreenEnabled = enabled) }
        viewModelScope.launch { sessionManager.setKioskFullscreenEnabled(enabled) }
    }

    fun updatePosDisplayScale(scale: Float) {
        val clamped = com.chaslay.pos.ui.theme.PosAppearanceLimits.clampDisplay(scale)
        _uiState.update { it.copy(posDisplayScale = clamped) }
        viewModelScope.launch { sessionManager.setPosDisplayScale(clamped) }
    }

    fun updatePosTextScale(scale: Float) {
        val clamped = com.chaslay.pos.ui.theme.PosAppearanceLimits.clampText(scale)
        _uiState.update { it.copy(posTextScale = clamped) }
        viewModelScope.launch { sessionManager.setPosTextScale(clamped) }
    }

    fun updatePosMenuDesign(design: PosMenuDesign) {
        _uiState.update { it.copy(posMenuDesign = design) }
        viewModelScope.launch { sessionManager.setPosMenuDesign(design) }
    }

    fun updatePosCompactLayoutPreference(preference: PosCompactLayoutPreference) {
        _uiState.update { it.copy(posCompactLayoutPreference = preference) }
        viewModelScope.launch { sessionManager.setPosCompactLayoutPreference(preference) }
    }

    fun refreshCrashLogs() {
        _uiState.update {
            it.copy(crashLogs = crashLogger.listLogs())
        }
    }

    fun selectCrashLog(fileName: String) {
        _uiState.update {
            it.copy(
                selectedCrashLog = fileName,
                crashLogContent = crashLogger.readLog(fileName)
            )
        }
    }

    fun clearCrashLogs() {
        crashLogger.clearLogs()
        refreshCrashLogs()
        _uiState.update { it.copy(selectedCrashLog = null, crashLogContent = "") }
    }

    fun refreshDiagnosticsPanel() {
        refreshCrashLogs()
        val status = remoteDiagnosticUploader.lastUploadStatus()
        val lastLabel = status.formatForUi().ifBlank {
            appContext.getString(com.chaslay.pos.R.string.diagnostics_last_upload_none)
        }
        _uiState.update {
            it.copy(
                diagnosticsLastUploadLabel = lastLabel,
                diagnosticsSessionPreview = posDiagnosticLogger.tailSessionLines(40),
                diagnosticsApiHostLabel = appContext.getString(
                    com.chaslay.pos.R.string.diagnostics_api_host,
                    BuildConfig.DIAGNOSTIC_API_BASE_URL.trimEnd('/'),
                ),
            )
        }
    }

    fun uploadDiagnosticsToSupport() {
        viewModelScope.launch {
            _uiState.update { it.copy(diagnosticsUploadInProgress = true, message = null) }
            val result = remoteDiagnosticUploader.uploadSupportBundle(manual = true)
            refreshDiagnosticsPanel()
            val msg = if (result.isSuccess) {
                appContext.getString(com.chaslay.pos.R.string.diagnostics_upload_sent)
            } else {
                result.exceptionOrNull()?.message
                    ?: appContext.getString(com.chaslay.pos.R.string.diagnostics_upload_failed)
            }
            _uiState.update {
                it.copy(diagnosticsUploadInProgress = false, message = msg)
            }
        }
    }

    fun shareDiagnosticsLogs() {
        viewModelScope.launch {
            try {
                val file = posDiagnosticLogger.writeShareExport(crashLogger)
                val authority = "${appContext.packageName}.fileprovider"
                val uri = FileProvider.getUriForFile(appContext, authority, file)
                val subject = appContext.getString(com.chaslay.pos.R.string.diagnostics_share_subject)
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, subject)
                    putExtra(Intent.EXTRA_TEXT, subject)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    clipData = android.content.ClipData.newRawUri(subject, uri)
                    if (appContext !is android.app.Activity) {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                val chooserTitle = appContext.getString(com.chaslay.pos.R.string.diagnostics_share_chooser)
                val chooser = Intent.createChooser(send, chooserTitle).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    if (appContext !is android.app.Activity) {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
                _shareDiagnosticsIntent.send(chooser)
            } catch (t: Throwable) {
                posDiagnosticLogger.logWarn("DiagnosticsShare", "share sheet", t)
                _uiState.update {
                    it.copy(message = t.message ?: appContext.getString(com.chaslay.pos.R.string.diagnostics_upload_failed))
                }
            }
        }
    }

    private fun loadSavedPrinters() {
        viewModelScope.launch {
            val printers = settingsRepository.getPrinters()
            printers.filter { it.connectionType == "USB" && !it.address.startsWith("usb:") }
                .forEach { printer ->
                    val migrated = usbPrinterManager.normalizeStoredAddress(printer.address)
                    if (migrated.startsWith("usb:") && migrated != printer.address) {
                        settingsRepository.savePrinter(printer.copy(address = migrated))
                    }
                }
            if (SunmiInternalPrinter.isSunmiDevice()) {
                printers.forEach { printer ->
                    if (!SunmiInternalPrinter.shouldMigrateStoredPrinter(
                            printer.address,
                            printer.name,
                            printer.connectionType,
                        )
                    ) {
                        return@forEach
                    }
                    val coerced = SunmiInternalPrinter.coerceForStorage(
                        printer.address,
                        printer.name,
                        printer.connectionType,
                    )
                    settingsRepository.savePrinter(
                        printer.copy(
                            address = coerced.address,
                            name = coerced.name,
                            connectionType = coerced.connectionType,
                        ),
                    )
                }
            }
            _uiState.update { it.copy(savedPrinters = settingsRepository.getPrinters()) }
            usbPrinterManager.setMonitoredPrinterAddresses(
                settingsRepository.getPrinters()
                    .filter { it.connectionType == "USB" || UsbPrinterManager.isUsbAddress(it.address) }
                    .map { usbPrinterManager.normalizeStoredAddress(it.address) }
            )
            if (_uiState.value.selectedSection == SettingsSection.PRINTERS) {
                refreshPrinterConnectionState()
            }
        }
    }

    fun printerReachabilityKey(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity): String {
        val coerced = SunmiInternalPrinter.coerceForStorage(
            printer.address,
            printer.name,
            printer.connectionType,
        )
        return when {
            coerced.connectionType.equals("SUNMI", ignoreCase = true) ||
                SunmiInternalPrinter.isInternalAddress(coerced.address) ->
                SunmiInternalPrinter.INTERNAL_ADDRESS
            coerced.connectionType == "USB" ->
                usbPrinterManager.normalizeStoredAddress(coerced.address)
            else -> coerced.address.trim()
        }
    }

    fun refreshPrinterConnectionState() {
        printerReachabilityRefreshJob?.cancel()
        printerReachabilityRefreshJob = viewModelScope.launch {
            delay(PRINTER_REACHABILITY_DEBOUNCE_MS)
            val printers = _uiState.value.savedPrinters
            if (printers.isEmpty()) {
                _uiState.update { it.copy(printerReachability = emptyMap(), isProbingPrinters = false) }
                return@launch
            }
            _uiState.update { it.copy(isProbingPrinters = true) }
            usbPrinterManager.syncGrantedDevicesFromSystem()
            val reachability = linkedMapOf<String, Boolean>()
            for (printer in printers) {
                val coerced = SunmiInternalPrinter.coerceForStorage(
                    printer.address,
                    printer.name,
                    printer.connectionType,
                )
                val key = printerReachabilityKey(printer)
                val reachable = withContext(Dispatchers.IO) {
                    printerService.probePrinterReachable(
                        coerced.address,
                        coerced.connectionType,
                        coerced.name,
                    )
                }
                reachability[key] = reachable
            }
            _uiState.update { it.copy(printerReachability = reachability, isProbingPrinters = false) }
        }
    }

    fun refreshPlatformAboutFromCloud() {
        viewModelScope.launch {
            val html = withContext(Dispatchers.IO) {
                menuSyncRepository.refreshPlatformAboutHtml()
            }
            val resolved = html ?: settingsRepository.getSettings().platformAboutHtml.orEmpty()
            _uiState.update { it.copy(platformAboutHtml = resolved) }
        }
    }

    private fun syncMonitoredScaleUsbAddress() {
        val address = _uiState.value.scaleUsbAddress?.trim()?.takeIf { it.isNotEmpty() }
        usbPrinterManager.setMonitoredScaleAddresses(
            listOfNotNull(address?.let { usbPrinterManager.normalizeStoredAddress(it) })
        )
    }

    fun refreshScaleConnectionState() {
        viewModelScope.launch {
            val address = _uiState.value.scaleUsbAddress?.trim().orEmpty()
            if (address.isBlank()) {
                _uiState.update {
                    it.copy(
                        scaleUsbDeviceAttached = false,
                        scaleUsbHasPermission = false,
                        scaleReachability = null,
                        isProbingScale = false,
                        scaleLastProbeAtMs = null,
                    )
                }
                return@launch
            }
            _uiState.update { it.copy(isProbingScale = true) }
            usbPrinterManager.syncGrantedDevicesFromSystem()
            val attached = usbPrinterManager.resolveDevice(address) != null
            val permitted = scaleService.hasPermission(address)
            val reachable = withContext(Dispatchers.IO) {
                when {
                    !attached || !permitted -> false
                    else -> scaleService.probeReachable(address)
                }
            }
            val probedAt = System.currentTimeMillis()
            _uiState.update {
                it.copy(
                    scaleUsbDeviceAttached = attached,
                    scaleUsbHasPermission = permitted,
                    scaleReachability = reachable,
                    isProbingScale = false,
                    scaleLastProbeAtMs = probedAt,
                )
            }
        }
    }

    fun showAddPrinterDialog() = _uiState.update {
        val sunmiHint = if (SunmiInternalPrinter.isSunmiDevice()) {
            listOf(
                DiscoveredPrinter(
                    name = SunmiInternalPrinter.builtInPickerLabel(),
                    address = SunmiInternalPrinter.INTERNAL_ADDRESS,
                ),
            )
        } else {
            emptyList()
        }
        it.copy(
            showAddPrinterDialog = true,
            editingPrinter = null,
            printers = sunmiHint,
            printerDiscoveryMessage = if (sunmiHint.isNotEmpty()) {
                "SUNMI tab: tap built-in or Save — no long Bluetooth scan needed"
            } else {
                null
            },
        )
    }

    fun clearNetworkDiscovery() {
        _uiState.update {
            it.copy(
                networkPrinters = emptyList(),
                printers = emptyList(),
                isDiscoveryScanBusy = false,
                isPrinterBusy = false,
                printerDiscoveryMessage = null,
            )
        }
    }

    fun dismissAddPrinterDialog() {
        clearNetworkDiscovery()
        _uiState.update {
            it.copy(
                showAddPrinterDialog = false,
                editingPrinter = null,
                usbDevices = emptyList(),
                printerDiscoveryMessage = null,
            )
        }
    }

    fun editPrinter(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity) {
        _uiState.update { it.copy(showAddPrinterDialog = true, editingPrinter = printer) }
    }

    fun addPrinter(form: AddPrinterForm) {
        viewModelScope.launch {
            val resolved = form.normalized()
            if (resolved.address.isBlank()) {
                _uiState.update { it.copy(message = "Enter a printer address") }
                return@launch
            }
            val coerced = com.chaslay.pos.printer.SunmiInternalPrinter.coerceForStorage(
                resolved.address,
                resolved.name,
                resolved.connectionType,
            )
            val address = when {
                coerced.connectionType == "USB" ->
                    usbPrinterManager.normalizeStoredAddress(coerced.address)
                else -> coerced.address
            }
            val connectionType = coerced.connectionType
            if (connectionType == "USB" && !usbPrinterManager.hasPermission(address)) {
                _uiState.update { it.copy(message = "Allow USB access first, then save again") }
                usbPrinterManager.requestPermission(address) { granted ->
                    viewModelScope.launch {
                        _uiState.update {
                            it.copy(
                                usbDevices = usbPrinterManager.listDevices(),
                                message = if (granted) "USB permission granted — tap Save again" else "USB permission denied"
                            )
                        }
                    }
                }
                return@launch
            }
            val finalForm = resolved.copy(
                address = address,
                name = coerced.name,
                connectionType = connectionType,
            )
            val editing = _uiState.value.editingPrinter
            val entity = if (editing != null) {
                finalForm.toEntity(editing.sortOrder).copy(id = editing.id, createdAt = editing.createdAt)
            } else {
                finalForm.toEntity(_uiState.value.savedPrinters.size)
            }
            val saveResult = runCatching { settingsRepository.savePrinter(entity) }
            if (saveResult.isFailure) {
                val err = saveResult.exceptionOrNull()
                posDiagnosticLogger.logWarn(
                    "PrinterSave",
                    "connectionType=${entity.connectionType} address=${entity.address}",
                    err,
                )
                _uiState.update {
                    it.copy(message = "Printer save failed: ${err?.message ?: "unknown error"}")
                }
                return@launch
            }
            loadSavedPrinters()
            val savedMsg = if (editing != null) "Printer updated" else "Printer added"
            dismissAddPrinterDialog()
            _uiState.update {
                it.copy(
                    message = savedMsg,
                    printerDiscoveryMessage = null,
                )
            }
            if (coerced.connectionType.equals("SUNMI", ignoreCase = true)) {
                withContext(Dispatchers.IO) {
                    printerService.warmupConnection(coerced.address, coerced.connectionType)
                }
                refreshPrinterConnectionState()
            }
        }
    }

    fun deleteSavedPrinter(id: String) {
        viewModelScope.launch {
            settingsRepository.deletePrinter(id)
            loadSavedPrinters()
        }
    }

    fun testAddPrinterForm(form: AddPrinterForm) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isPrinterBusy = true,
                    printerDiscoveryMessage = "Sending test print…",
                )
            }
            try {
                val normalized = form.normalized()
                val coerced = SunmiInternalPrinter.coerceForStorage(
                    normalized.address,
                    normalized.name,
                    normalized.connectionType,
                )
                val result = withContext(Dispatchers.IO) {
                    if (coerced.connectionType == "SUNMI") {
                        printerService.warmupConnection(
                            coerced.address,
                            coerced.connectionType,
                        )
                    }
                    when {
                        coerced.connectionType == "SUNMI" ->
                            printerService.testPrint(
                                buildSettingsFromState().copy(
                                    printerMacAddress = coerced.address,
                                    printerName = coerced.name,
                                ),
                                connectionType = coerced.connectionType,
                            )
                        coerced.connectionType == "USB" -> usbPrinterManager.sendBytes(
                            usbPrinterManager.normalizeStoredAddress(coerced.address),
                            usbPrinterManager.buildTestPayload(),
                        )
                        else -> printerService.testPrint(
                            buildSettingsFromState().copy(
                                printerMacAddress = coerced.address,
                                printerName = coerced.name,
                            ),
                            connectionType = coerced.connectionType,
                        )
                    }
                }
                val summary = result.fold(
                    onSuccess = { "Test print sent" },
                    onFailure = { err ->
                        posDiagnosticLogger.logWarn(
                            "PrinterTest",
                            "add-dialog type=${coerced.connectionType} address=${coerced.address}",
                            err,
                        )
                        if (coerced.connectionType == "SUNMI") {
                            posDiagnosticLogger.logSunmiBind(
                                "test_failed",
                                err.message ?: err.javaClass.simpleName,
                            )
                        }
                        PrinterUserMessages.fromPrintFailure(appContext, coerced.name, err)
                    },
                )
                _uiState.update {
                    it.copy(message = summary, printerDiscoveryMessage = summary)
                }
            } catch (e: Exception) {
                posDiagnosticLogger.logWarn("PrinterTest", "add-dialog unexpected", e)
                val summary = PrinterUserMessages.fromPrintFailure(
                    appContext,
                    form.name.ifBlank { form.address },
                    e,
                )
                _uiState.update {
                    it.copy(message = summary, printerDiscoveryMessage = summary)
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    private fun loadDiscountPresets() {
        viewModelScope.launch {
            val presets = settingsRepository.getDiscountPresets()
            _uiState.update { it.copy(discountPresets = presets) }
        }
    }

    private fun resolvePrinter(mac: String?, name: String?): DiscoveredPrinter? {
        if (mac.isNullOrBlank()) return null
        return if (BluetoothPrinterService.isSimulated(mac)) {
            BluetoothPrinterService.SIMULATED_PRINTER
        } else {
            DiscoveredPrinter(name ?: mac, mac)
        }
    }

    private fun loadTables() {
        viewModelScope.launch {
            val tables = tableOrderRepository.getAllTables().map { it.name }
            _uiState.update { it.copy(tables = tables) }
        }
    }

    fun updateBusinessName(value: String) = _uiState.update { it.copy(businessName = value) }
    fun updatePosMode(mode: PosMode) = _uiState.update {
        it.copy(
            posMode = mode,
            requireTableForDineIn = if (mode == PosMode.RETAIL) false else it.requireTableForDineIn,
            selectedSection = coerceRestaurantOnlySection(mode, it.selectedSection),
        )
    }
    fun updateCoursesEnabled(enabled: Boolean) = _uiState.update { it.copy(coursesEnabled = enabled) }
    fun updateCourseSendMode(mode: CourseSendMode) = _uiState.update { it.copy(courseSendMode = mode) }
    fun updateTablesEnabled(enabled: Boolean) = _uiState.update { it.copy(tablesEnabled = enabled) }

    fun updateReservationsEnabled(enabled: Boolean) {
        if (_uiState.value.reservationsToggleSaving) return
        if (!syncApiKeyStore.hasKey()) {
            _uiState.update {
                it.copy(message = appContext.getString(R.string.settings_reservations_cloud_required))
            }
            return
        }
        val previous = _uiState.value.reservationsEnabled
        _uiState.update {
            it.copy(reservationsEnabled = enabled, reservationsToggleSaving = true, message = null)
        }
        viewModelScope.launch {
            val result = reservationSyncRepository.setModuleEnabled(enabled)
            if (result.success) {
                runCatching { terminalSyncRepository.syncTerminals() }
                if (enabled) {
                    runCatching { reservationSyncRepository.syncReservations() }
                } else {
                    runCatching { reservationSyncRepository.syncReservations() }
                }
                currentSettings = settingsRepository.getSettings()
                _uiState.update {
                    it.copy(
                        reservationsEnabled = currentSettings.reservationsEnabled,
                        reservationsToggleSaving = false,
                        message = "Settings saved"
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        reservationsEnabled = previous,
                        reservationsToggleSaving = false,
                        message = result.error ?: appContext.getString(R.string.reservations_action_failed)
                    )
                }
            }
        }
    }
    fun updateRetailDineInEnabled(enabled: Boolean) = _uiState.update { it.copy(retailDineInEnabled = enabled) }

    fun updateRetailWeighedCustomEntryEnabled(enabled: Boolean) =
        _uiState.update { it.copy(retailWeighedCustomEntryEnabled = enabled) }

    fun updateRestaurantWeighedCustomEntryEnabled(enabled: Boolean) =
        _uiState.update { it.copy(restaurantWeighedCustomEntryEnabled = enabled) }

    fun updateRetailTakeawayEnabled(enabled: Boolean) = _uiState.update { it.copy(retailTakeawayEnabled = enabled) }
    fun updateRetailDeliveryEnabled(enabled: Boolean) = _uiState.update { it.copy(retailDeliveryEnabled = enabled) }
    fun updateRequireTableForDineIn(enabled: Boolean) = _uiState.update { it.copy(requireTableForDineIn = enabled) }
    fun updateTrackCoversFromSeatingPlan(enabled: Boolean) =
        _uiState.update { it.copy(trackCoversFromSeatingPlan = enabled) }

    fun updateSyncBusinessInfo(enabled: Boolean) {
        viewModelScope.launch {
            syncPreferences.setSyncBusinessInfoEnabled(enabled)
            _uiState.update { it.copy(syncBusinessInfo = enabled) }
        }
    }

    fun pullOnlineMenuReplace() {
        viewModelScope.launch {
            _uiState.update { it.copy(isMenuSyncing = true, message = null) }
            val result = runCatching { syncService.pullMenuReplace() }
            _uiState.update {
                it.copy(
                    isMenuSyncing = false,
                    message = result.fold(
                        onSuccess = { r ->
                            if (r.skipped) r.message ?: "Menu sync skipped (no API key — log in with panel email)"
                            else r.message ?: "Replaced local menu with online menu (${r.products} products)"
                        },
                        onFailure = { e -> e.message ?: "Pull menu failed" }
                    )
                )
            }
            reloadBusinessFieldsFromSettings()
        }
    }

    private suspend fun reloadBusinessFieldsFromSettings() {
        val settings = settingsRepository.getSettings()
        currentSettings = settings
        val posSession = loadPosSessionDisplay(settings.businessName)
        _uiState.update {
            it.copy(
                posSession = posSession,
                businessName = settings.businessName,
                vatNumber = settings.vatNumber,
                address = settings.address,
                phone = settings.phone,
                email = settings.email,
                dineInVatRate = settings.dineInVatRate.toString(),
                takeawayVatRate = settings.takeawayVatRate.toString(),
                openHour = settings.openHour.toString(),
                openMinute = settings.openMinute.toString(),
                closeHour = settings.closeHour.toString(),
                closeMinute = settings.closeMinute.toString(),
                language = AppLanguage.fromCode(settings.defaultLanguage),
                platformAboutHtml = settings.platformAboutHtml.orEmpty(),
                posMode = settings.posMode,
                selectedSection = coerceRestaurantOnlySection(settings.posMode, it.selectedSection),
            )
        }
    }

    private suspend fun loadPosSessionDisplay(businessName: String): PosSessionDisplay {
        val userId = sessionManager.currentUserId.first()
        val staffName = sessionManager.currentUserName.first()
        val access = sessionManager.currentUserAccess.first()
        val staffUser = userId?.let { authRepository.getUser(it) }
        var dashboardEmail: String? = null
        var dashboardName: String? = null
        syncPreferences.getDashboardUserJson()?.let { json ->
            runCatching {
                val o = org.json.JSONObject(json)
                dashboardEmail = o.optString("email").trim().takeIf { it.isNotEmpty() }
                dashboardName = o.optString("name").trim().takeIf { it.isNotEmpty() }
            }
        }
        val merchantLinked = !syncPreferences.getMerchantId().isNullOrBlank()
        val dashboardSignedIn = !syncPreferences.getDashboardToken().isNullOrBlank()
        val rawStaffEmail = staffUser?.email?.trim()?.takeIf { it.isNotEmpty() }
        val staffEmail = rawStaffEmail?.takeIf { !it.startsWith("sync:", ignoreCase = true) }
        val isSyncedStaff = rawStaffEmail?.startsWith("sync:", ignoreCase = true) == true
        val merchantAccountEmail = dashboardEmail
            ?: staffEmail?.takeIf { merchantLinked && (staffUser?.id ?: 0L) >= 100_000L }
        val shopName = businessName.trim().takeIf { it.isNotEmpty() }
            ?: dashboardName
        return PosSessionDisplay(
            staffName = staffName ?: staffUser?.name,
            staffEmail = staffEmail,
            staffRole = access?.roleName,
            merchantAccountEmail = merchantAccountEmail,
            merchantShopName = shopName,
            merchantLinked = merchantLinked,
            dashboardSignedIn = dashboardSignedIn,
            isSyncedStaffAccount = isSyncedStaff,
        )
    }

    fun pullOnlineMenuMerge() {
        viewModelScope.launch {
            _uiState.update { it.copy(isMenuSyncing = true, message = null) }
            val result = runCatching { syncService.pullMenuMerge() }
            _uiState.update {
                it.copy(
                    isMenuSyncing = false,
                    message = result.fold(
                        onSuccess = { r ->
                            if (r.skipped) r.message ?: "Menu sync skipped (no API key — log in with panel email)"
                            else r.message ?: "Merged online menu (${r.products} products)"
                        },
                        onFailure = { e -> e.message ?: "Merge menu failed" }
                    )
                )
            }
            reloadBusinessFieldsFromSettings()
        }
    }

    fun pushMenuToPanel() {
        viewModelScope.launch {
            _uiState.update { it.copy(isMenuSyncing = true, message = null) }
            val result = runCatching { syncService.pushMenuToPanel() }
            _uiState.update {
                it.copy(
                    isMenuSyncing = false,
                    message = result.fold(
                        onSuccess = { r ->
                            if (r.skipped) r.message ?: "Push skipped (no API key — log in with panel email)"
                            else r.message ?: "Pushed menu to panel"
                        },
                        onFailure = { e -> e.message ?: "Push menu failed" }
                    )
                )
            }
        }
    }

    fun updateFloorSyncEnabled(enabled: Boolean) {
        _uiState.update { it.copy(floorSyncEnabled = enabled) }
        persistFloorSettings()
    }

    fun updateFloorDeviceRole(role: FloorDeviceRole) {
        _uiState.update { it.copy(floorDeviceRole = role) }
        persistFloorSettings()
    }

    fun updateFloorConnectionMode(mode: FloorConnectionMode) {
        _uiState.update { it.copy(floorConnectionMode = mode) }
        persistFloorSettings()
    }

    fun updateMainPosLanUrl(value: String) {
        _uiState.update { it.copy(mainPosLanUrl = value) }
    }

    fun commitMainPosLanUrl() = persistFloorSettings()

    fun refreshLocalLanUrl() {
        _uiState.update { it.copy(localLanUrl = NetworkAddress.localLanUrl(FloorLanServer.PORT)) }
    }

    fun testMainPosConnection() {
        val url = _uiState.value.mainPosLanUrl.trim().trimEnd('/')
        if (url.isBlank()) {
            _uiState.update { it.copy(message = "Enter the main POS LAN URL first") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingMainPos = true) }
            val message = withContext(Dispatchers.IO) {
                runCatching {
                    val client = OkHttpClient.Builder()
                        .connectTimeout(3, TimeUnit.SECONDS)
                        .readTimeout(5, TimeUnit.SECONDS)
                        .build()
                    val response = client.newCall(
                        Request.Builder().url("$url/health").get().build()
                    ).execute()
                    response.close()
                    if (response.isSuccessful) "Main POS reachable on LAN" else "Main POS returned ${response.code}"
                }.getOrElse { "Cannot reach main POS: ${it.message ?: "unknown error"}" }
            }
            _uiState.update { it.copy(isTestingMainPos = false, message = message) }
        }
    }

    fun discoverMainPos() {
        viewModelScope.launch {
            _uiState.update { it.copy(isDiscoveringMainPos = true) }
            val url = floorSyncRepository.discoverMainPosUrl()
            if (url != null) {
                _uiState.update {
                    it.copy(
                        isDiscoveringMainPos = false,
                        mainPosLanUrl = url,
                        message = appContext.getString(R.string.floor_main_pos_found, url)
                    )
                }
                persistFloorSettings()
            } else {
                _uiState.update {
                    it.copy(
                        isDiscoveringMainPos = false,
                        message = appContext.getString(R.string.floor_main_pos_not_found)
                    )
                }
            }
        }
    }

    private fun persistFloorSettings() {
        viewModelScope.launch {
            val state = _uiState.value
            val updated = currentSettings.copy(
                floorSyncEnabled = state.floorSyncEnabled,
                floorDeviceRole = state.floorDeviceRole.apiValue,
                floorConnectionMode = state.floorConnectionMode.apiValue,
                mainPosLanUrl = state.mainPosLanUrl.trim()
            )
            settingsRepository.saveSettings(updated)
            currentSettings = updated
            runCatching { floorSyncRepository.registerDevice(updated) }
            _uiState.update {
                it.copy(
                    message = appContext.getString(R.string.floor_settings_saved),
                    localLanUrl = if (state.floorDeviceRole == FloorDeviceRole.MAIN_POS) {
                        NetworkAddress.localLanUrl(FloorLanServer.PORT)
                    } else {
                        it.localLanUrl
                    }
                )
            }
        }
    }

    fun updateOpenHour(value: String) = _uiState.update { it.copy(openHour = value) }
    fun updateOpenMinute(value: String) = _uiState.update { it.copy(openMinute = value) }
    fun updateCloseHour(value: String) = _uiState.update { it.copy(closeHour = value) }
    fun updateCloseMinute(value: String) = _uiState.update { it.copy(closeMinute = value) }
    fun updateVatNumber(value: String) = _uiState.update { it.copy(vatNumber = value) }
    fun updateAddress(value: String) = _uiState.update { it.copy(address = value) }
    fun updatePhone(value: String) = _uiState.update { it.copy(phone = value) }
    fun updateEmail(value: String) = _uiState.update { it.copy(email = value) }
    fun updateReceiptHeader(value: String) = _uiState.update { it.copy(receiptHeader = value.take(500)) }
    fun updateReceiptFooter(value: String) = _uiState.update { it.copy(receiptFooter = value.take(500)) }
    fun updateKitchenHeader(value: String) = _uiState.update { it.copy(kitchenTicketHeader = value) }
    fun updateKitchenFooter(value: String) = _uiState.update { it.copy(kitchenTicketFooter = value) }
    fun updateReceiptShowVatTable(value: Boolean) = _uiState.update { it.copy(receiptShowVatTable = value) }
    fun updateReceiptShowStaffLine(value: Boolean) = _uiState.update { it.copy(receiptShowStaffLine = value) }
    fun updateReceiptShowQrCode(value: Boolean) = _uiState.update { it.copy(receiptShowQrCode = value) }
    fun updateReceiptDeliveryDirectionsQr(value: Boolean) =
        _uiState.update { it.copy(receiptDeliveryDirectionsQr = value) }
    fun updateAdyenReceiptDigitalOnly(value: Boolean) = _uiState.update { it.copy(adyenReceiptDigitalOnly = value) }

    fun updateAutoPrintReceipt(enabled: Boolean) = _uiState.update { it.copy(autoPrintReceipt = enabled) }
    fun updateAutoPrintKitchen(enabled: Boolean) = _uiState.update { it.copy(autoPrintKitchen = enabled) }
    fun updateKitchenLargeItems(value: Boolean) = _uiState.update { it.copy(kitchenLargeItemText = value) }
    fun updateKitchenLargeHeader(value: Boolean) = _uiState.update { it.copy(kitchenLargeHeaderText = value) }
    fun updateKitchenItemTextScale(scale: Int) = _uiState.update {
        it.copy(
            kitchenItemTextScale = scale.coerceIn(1, 3),
            kitchenLargeItemText = scale > 1
        )
    }
    fun updateKitchenHeaderTextScale(scale: Int) = _uiState.update {
        it.copy(
            kitchenHeaderTextScale = scale.coerceIn(1, 3),
            kitchenLargeHeaderText = scale > 1
        )
    }
    fun updateLogoUri(uri: String?) = _uiState.update { it.copy(logoUri = uri) }
    fun clearLogo() = _uiState.update { it.copy(logoUri = null) }

    fun importLogo(sourceUri: Uri) {
        viewModelScope.launch {
            runCatching {
                val dest = File(appContext.filesDir, "receipt_logo.png")
                appContext.contentResolver.openInputStream(sourceUri)?.use { input ->
                    dest.outputStream().use { output -> input.copyTo(output) }
                } ?: error("Could not read image")
                _uiState.update { it.copy(logoUri = dest.absolutePath, message = "Logo updated") }
            }.onFailure { e ->
                _uiState.update { it.copy(message = e.message ?: "Logo import failed") }
            }
        }
    }
    fun updateReceiptTemplateName(value: String) = _uiState.update { it.copy(receiptTemplateName = value) }

    fun previewReceiptText(): String =
        printerService.buildSettingsPreviewReceiptText(buildSettingsFromState())
    /**
     * Take payment methods off panel control for this device, or hand them back.
     * The individual payment switches are disabled while the panel owns them, so
     * this is the only way to set them locally.
     */
    fun updatePaymentMethodsLocalOverride(enabled: Boolean) = _uiState.update {
        it.copy(paymentMethodsManagedByCloud = !enabled)
    }

    fun updateTapToPay(enabled: Boolean) = _uiState.update {
        it.copy(tapToPayEnabled = enabled, paymentMethodsManagedByCloud = false)
    }
    fun updateAdyenEnabled(enabled: Boolean) {
        com.chaslay.pos.util.PosLocalPrefs.saveAdyenTerminalEnabled(appContext, enabled)
        com.chaslay.pos.util.PosLocalPrefs.saveTerminalTenderEnabled(
            appContext,
            enabled || _uiState.value.terminalEnabled
        )
        _uiState.update {
            it.copy(
                adyenTerminalEnabled = enabled,
                terminalEnabled = enabled || it.terminalEnabled,
                paymentMethodsManagedByCloud = false,
            )
        }
    }
    fun updateAdyenTerminalId(value: String) = _uiState.update { it.copy(adyenTerminalId = value) }
    fun updateAdyenApiKey(value: String) = _uiState.update { it.copy(adyenApiKey = value) }
    fun updateAdyenClientId(value: String) = _uiState.update { it.copy(adyenClientId = value) }
    fun updateAdyenMerchantAccount(value: String) = _uiState.update { it.copy(adyenMerchantAccount = value) }
    fun updateAdyenLiveEnvironment(enabled: Boolean) = _uiState.update { it.copy(adyenLiveEnvironment = enabled) }
    fun updateAdyenLiveRegion(value: String) = _uiState.update { it.copy(adyenLiveRegion = value) }
    fun updateAdyenUseLegacyEndpoint(enabled: Boolean) = _uiState.update { it.copy(adyenUseLegacyEndpoint = enabled) }

    /** Re-reads why Tap to Pay can or cannot run, so Settings shows a current status. */
    fun refreshTapToPayReadiness() {
        viewModelScope.launch {
            val readiness = tapToPayEngine.readiness()
            _uiState.update { it.copy(tapToPayReadiness = readiness) }
        }
    }

    /**
     * Runs Adyen device attestation from Settings. Deliberately not done during a
     * sale: first-run attestation is slow and its failures look like a declined card.
     */
    fun activateTapToPay() {
        viewModelScope.launch {
            _uiState.update { it.copy(isActivatingTapToPay = true) }
            val result = tapToPayEngine.registerDevice()
            val readiness = tapToPayEngine.readiness()
            _uiState.update {
                it.copy(
                    isActivatingTapToPay = false,
                    tapToPayReadiness = readiness,
                    message = result.message,
                )
            }
        }
    }

    fun testAdyenConnection() {
        viewModelScope.launch {
            _uiState.update { it.copy(isTestingAdyen = true) }
            val settings = buildSettingsFromState()
            val message = adyenTerminalService.testConnection(settings)
            _uiState.update { it.copy(isTestingAdyen = false, message = message) }
        }
    }
    fun updateRoundingStep(value: String) = _uiState.update { it.copy(roundingStep = value) }
    fun updateCashEnabled(enabled: Boolean) = _uiState.update {
        it.copy(cashEnabled = enabled, paymentMethodsManagedByCloud = false)
    }
    fun updateCardEnabled(enabled: Boolean) = _uiState.update {
        it.copy(cardEnabled = enabled, paymentMethodsManagedByCloud = false)
    }
    fun updateTerminalEnabled(enabled: Boolean) {
        com.chaslay.pos.util.PosLocalPrefs.saveTerminalTenderEnabled(appContext, enabled)
        _uiState.update {
            it.copy(terminalEnabled = enabled, paymentMethodsManagedByCloud = false)
        }
    }
    fun updateExpressEnabled(enabled: Boolean) = _uiState.update {
        it.copy(expressEnabled = enabled, paymentMethodsManagedByCloud = false)
    }
    fun updateExpressPayPlacement(placement: ExpressPayPlacement) = _uiState.update {
        it.copy(expressPayPlacement = placement)
    }
    fun updateAfterSaleGoToOrders(goToOrders: Boolean) = _uiState.update {
        it.copy(afterSaleGoToOrders = goToOrders)
    }
    fun updateRetailCashTenderDialogEnabled(enabled: Boolean) = _uiState.update {
        it.copy(retailCashTenderDialogEnabled = enabled)
    }
    fun updateGiftCardsEnabled(enabled: Boolean) {
        _uiState.update {
            it.copy(giftCardsEnabled = enabled, paymentMethodsManagedByCloud = false)
        }
        saveSettings()
    }
    fun updateInvoiceEnabled(enabled: Boolean) {
        _uiState.update {
            it.copy(invoiceEnabled = enabled, paymentMethodsManagedByCloud = false)
        }
        saveSettings()
    }
    fun updatePrinterPrintReceipts(enabled: Boolean) = _uiState.update { it.copy(printerPrintReceipts = enabled) }
    fun updatePrinterPrintReports(enabled: Boolean) = _uiState.update { it.copy(printerPrintReports = enabled) }
    fun updatePrinterPrintKitchen(enabled: Boolean) = _uiState.update { it.copy(printerPrintKitchen = enabled) }
    fun updateKitchenPrinterPrintKitchen(enabled: Boolean) = _uiState.update { it.copy(kitchenPrinterPrintKitchen = enabled) }
    fun updateDineInVatRate(value: String) = _uiState.update { it.copy(dineInVatRate = value) }
    fun updateTakeawayVatRate(value: String) = _uiState.update { it.copy(takeawayVatRate = value) }
    fun updateVatIncludedInPrice(value: Boolean) {
        _uiState.update { it.copy(vatIncludedInPrice = value) }
        com.chaslay.pos.util.PosLocalPrefs.saveVatIncludedInPrice(appContext, value)
        saveSettings()
    }
    fun updateNewTableName(value: String) = _uiState.update { it.copy(newTableName = value) }

    fun updateNewPresetName(value: String) = _uiState.update { it.copy(newPresetName = value) }
    fun updateNewPresetPercent(value: String) = _uiState.update { it.copy(newPresetPercent = value) }

    fun addDiscountPreset() {
        viewModelScope.launch {
            val name = _uiState.value.newPresetName.trim()
            val percent = _uiState.value.newPresetPercent.toDoubleOrNull()
            if (name.isEmpty() || percent == null) {
                _uiState.update { it.copy(message = "Enter preset name and percent") }
                return@launch
            }
            settingsRepository.saveDiscountPreset(name, percent)
            _uiState.update { it.copy(newPresetName = "", newPresetPercent = "", message = "Preset added") }
            loadDiscountPresets()
        }
    }

    fun addTable() {
        viewModelScope.launch {
            val name = _uiState.value.newTableName.trim()
            if (name.isEmpty()) {
                _uiState.update { it.copy(message = "Enter a table name") }
                return@launch
            }
            tableOrderRepository.addTable(name)
            _uiState.update { it.copy(newTableName = "", message = "Table added") }
            loadTables()
        }
    }

    fun updateCurrency(currency: SupportedCurrency) {
        _uiState.update { it.copy(defaultCurrency = currency.code, currencySymbol = currency.symbol) }
    }

    fun updateLanguage(language: AppLanguage) {
        viewModelScope.launch {
            sessionManager.setLanguage(language)
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.code))
            _uiState.update { it.copy(language = language) }
        }
    }

    fun updateCategoryPrintTarget(categoryId: Long, target: PrintTarget) {
        viewModelScope.launch {
            productRepository.updateCategoryPrintTarget(categoryId, target)
            _uiState.update { state ->
                state.copy(
                    categoryPrintSettings = state.categoryPrintSettings.map {
                        if (it.id == categoryId) it.copy(printTarget = target) else it
                    },
                    message = "Category routing updated"
                )
            }
        }
    }

    fun discoverSunmiPrinters() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(isDiscoveryScanBusy = true, printerDiscoveryMessage = "Loading Sunmi built-in…")
            }
            try {
                val printers = withContext(Dispatchers.IO) {
                    printerService.discoverSunmiBuiltInPrinters()
                }
                _uiState.update {
                    it.copy(
                        printers = printers,
                        printerDiscoveryMessage = "Tap Sunmi built-in — address is ${SunmiInternalPrinter.INTERNAL_ADDRESS}",
                    )
                }
            } catch (e: Exception) {
                posDiagnosticLogger.logWarn("PrinterDiscover", "sunmi tab", e)
                _uiState.update {
                    it.copy(printerDiscoveryMessage = "Sunmi setup failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isDiscoveryScanBusy = false) }
            }
        }
    }

    fun discoverPrinters(hasBluetoothPermission: Boolean) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(isDiscoveryScanBusy = true, printerDiscoveryMessage = "Scanning for devices…")
            }
            try {
                val printers = withContext(Dispatchers.IO) {
                    printerService.discoverPrinters(hasBluetoothPermission)
                }
                _uiState.update {
                    it.copy(
                        printers = printers,
                        printerDiscoveryMessage = if (hasBluetoothPermission) {
                            "${printers.size} printer(s) found"
                        } else {
                            "Simulated printer only. Grant Bluetooth to scan paired devices."
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(printerDiscoveryMessage = "Bluetooth scan failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isDiscoveryScanBusy = false) }
            }
        }
    }

    fun discoverNetworkPrinters(manualAddress: String = "") {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isDiscoveryScanBusy = true,
                    printerDiscoveryMessage = "Scanning Wi-Fi network…",
                )
            }
            try {
                val extras = manualAddress.trim().takeIf { it.isNotBlank() }?.let { listOf(it) }.orEmpty()
                val found = withContext(Dispatchers.IO) {
                    printerService.discoverNetworkPrinters(extraHosts = extras)
                }
                val localIp = printerService.currentLocalIpv4()
                _uiState.update {
                    it.copy(
                        networkPrinters = found,
                        printerDiscoveryMessage = when {
                            found.isNotEmpty() -> "${found.size} network printer(s) found"
                            localIp == null ->
                                "Cannot detect Wi-Fi IP. Connect this device to the same Wi-Fi as the printer."
                            manualAddress.isNotBlank() ->
                                "No reply from ${manualAddress.trim()} or subnet $localIp. Check IP and port 9100."
                            else ->
                                "No network printers found on $localIp (port 9100). Enter the IP and tap Verify."
                        }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(printerDiscoveryMessage = "Network scan failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isDiscoveryScanBusy = false) }
            }
        }
    }

    fun verifyNetworkPrinterAddress(address: String) {
        val trimmed = address.trim()
        if (trimmed.isBlank()) {
            _uiState.update { it.copy(message = "Enter an IP address first") }
            return
        }
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isDiscoveryScanBusy = true,
                    printerDiscoveryMessage = "Checking $trimmed…",
                )
            }
            try {
                val reachable = withContext(Dispatchers.IO) {
                    printerService.canReachNetworkPrinter(trimmed)
                }
                if (reachable) {
                    val (host, _) = parseHostPortForUi(trimmed)
                    val printer = DiscoveredPrinter("Network printer ($host)", host)
                    _uiState.update {
                        it.copy(
                            networkPrinters = (listOf(printer) + it.networkPrinters).distinctBy { p -> p.address },
                            printerDiscoveryMessage = "Printer reachable at $host — tap Add printer to save",
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(printerDiscoveryMessage = "Cannot reach $trimmed on port 9100. Check IP and Wi-Fi.")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(printerDiscoveryMessage = "Connection check failed: ${e.message ?: "unknown error"}")
                }
            } finally {
                _uiState.update { it.copy(isDiscoveryScanBusy = false) }
            }
        }
    }

    private fun parseHostPortForUi(address: String): Pair<String, Int> {
        val trimmed = address.trim()
        val colon = trimmed.lastIndexOf(':')
        return if (colon > 0 && trimmed.substring(colon + 1).toIntOrNull() != null) {
            trimmed.substring(0, colon) to trimmed.substring(colon + 1).toInt()
        } else {
            trimmed to 9100
        }
    }

    fun selectPrinter(printer: DiscoveredPrinter) {
        _uiState.update { it.copy(selectedPrinter = printer) }
    }

    fun selectKitchenPrinter(printer: DiscoveredPrinter) {
        _uiState.update { it.copy(selectedKitchenPrinter = printer) }
    }

    fun assignUsbAsReceipt(device: UsbPrinterDevice) {
        _uiState.update {
            it.copy(selectedPrinter = DiscoveredPrinter(name = device.displayName, address = device.stableAddress))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for receipts") }
    }

    fun assignUsbAsKitchen(device: UsbPrinterDevice) {
        _uiState.update {
            it.copy(selectedKitchenPrinter = DiscoveredPrinter(name = device.displayName, address = device.stableAddress))
        }
        saveSettings()
        _uiState.update { it.copy(message = "USB printer set for kitchen") }
    }

    fun discoverUsbDevices() {
        val devices = usbPrinterManager.listDevices()
        _uiState.update {
            it.copy(
                usbDevices = devices,
                printerDiscoveryMessage = if (devices.isEmpty()) {
                    "No USB printers detected — connect POS-80 via USB OTG"
                } else {
                    "${devices.size} USB printer(s) found — tap one, allow access once, then Save"
                }
            )
        }
    }

    fun requestUsbPermission(address: String) {
        usbPrinterManager.requestPermission(address) { granted ->
            viewModelScope.launch {
                _uiState.update {
                    it.copy(
                        usbDevices = usbPrinterManager.listDevices(),
                        message = if (granted) "USB permission granted" else "USB permission denied"
                    )
                }
            }
        }
    }

    fun testPrint() {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            try {
                val settings = buildSettingsFromState()
                val result = withContext(Dispatchers.IO) {
                    printerService.testPrint(settings)
                }
                _uiState.update {
                    it.copy(
                        message = result.fold(
                            onSuccess = {
                                if (BluetoothPrinterService.isSimulated(settings.printerMacAddress)) {
                                    "Test print sent to simulated printer (see Logcat)"
                                } else {
                                    "Test print sent"
                                }
                            },
                            onFailure = { err ->
                                posDiagnosticLogger.logWarn(
                                    "PrinterTest",
                                    "legacy settings address=${settings.printerMacAddress}",
                                    err,
                                )
                                PrinterUserMessages.fromPrintFailure(
                                    appContext,
                                    settings.printerName ?: settings.printerMacAddress,
                                    err,
                                )
                            }
                        )
                    )
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    fun testUsbPrint(address: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            try {
                val normalized = usbPrinterManager.normalizeStoredAddress(address)
                val result = withContext(Dispatchers.IO) {
                    usbPrinterManager.sendBytes(normalized, usbPrinterManager.buildTestPayload())
                }
                _uiState.update {
                    it.copy(
                        message = result.fold(
                            onSuccess = { "USB test print sent" },
                            onFailure = { err ->
                                PrinterUserMessages.fromPrintFailure(appContext, normalized, err)
                            }
                        )
                    )
                }
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    fun displayPrinterAddress(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity): String {
        if (printer.connectionType.equals("SUNMI", ignoreCase = true) ||
            com.chaslay.pos.printer.SunmiInternalPrinter.isInternalAddress(printer.address)
        ) {
            return com.chaslay.pos.printer.SunmiInternalPrinter.INTERNAL_ADDRESS
        }
        return if (printer.connectionType == "USB") {
            usbPrinterManager.formatAddressForDisplay(printer.address)
        } else {
            printer.address
        }
    }

    fun testSavedPrinter(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity) {
        viewModelScope.launch {
            _uiState.update { it.copy(isPrinterBusy = true) }
            try {
                val coerced = SunmiInternalPrinter.coerceForStorage(
                    printer.address,
                    printer.name,
                    printer.connectionType,
                )
                val result = withContext(Dispatchers.IO) {
                    when {
                        coerced.connectionType.equals("SUNMI", ignoreCase = true) ||
                            SunmiInternalPrinter.isInternalAddress(coerced.address) -> {
                            printerService.warmupConnection(coerced.address, "SUNMI")
                            printerService.testPrint(
                                buildSettingsFromState().copy(
                                    printerMacAddress = coerced.address,
                                    printerName = coerced.name,
                                ),
                                connectionType = "SUNMI",
                            )
                        }
                        coerced.connectionType == "USB" -> usbPrinterManager.sendBytes(
                            usbPrinterManager.normalizeStoredAddress(coerced.address),
                            usbPrinterManager.buildTestPayload(),
                        )
                        else ->
                            printerService.testPrint(
                                buildSettingsFromState().copy(
                                    printerMacAddress = coerced.address,
                                    printerName = coerced.name,
                                ),
                                connectionType = coerced.connectionType,
                            )
                    }
                }
                _uiState.update {
                    it.copy(
                        message = result.fold(
                            onSuccess = { "Test print sent to ${coerced.name}" },
                            onFailure = { err ->
                                posDiagnosticLogger.logWarn(
                                    "PrinterTest",
                                    "saved id=${printer.id} type=${coerced.connectionType} address=${coerced.address}",
                                    err,
                                )
                                if (coerced.connectionType.equals("SUNMI", ignoreCase = true)) {
                                    posDiagnosticLogger.logSunmiBind(
                                        "test_failed",
                                        err.message ?: err.javaClass.simpleName,
                                    )
                                }
                                PrinterUserMessages.fromPrintFailure(appContext, coerced.name, err)
                            },
                        )
                    )
                }
                refreshPrinterConnectionState()
            } finally {
                _uiState.update { it.copy(isPrinterBusy = false) }
            }
        }
    }

    fun printEndOfDayReport() {
        viewModelScope.launch {
            val settings = buildSettingsFromState()
            val report = transactionRepository.getEndOfDayReport()
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report)
            }.onSuccess { _uiState.update { it.copy(message = "End of day report printed") } }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(message = PrinterUserMessages.fromPrintFailure(appContext, cause = err))
                    }
                }
        }
    }

    fun saveSettings() {
        viewModelScope.launch {
            val previous = currentSettings
            val persisted = settingsRepository.getSettings()
            val settings = buildSettingsFromState().copy(
                receiptGoogleReviewsUrl = persisted.receiptGoogleReviewsUrl,
                receiptShowGoogleReviewQr = persisted.receiptShowGoogleReviewQr,
            )
            if (settings.autoPrintReceipt != previous.autoPrintReceipt) {
                com.chaslay.pos.util.PosLocalPrefs.saveAutoPrintReceipt(appContext, settings.autoPrintReceipt)
            }
            if (settings.autoPrintKitchen != previous.autoPrintKitchen) {
                com.chaslay.pos.util.PosLocalPrefs.saveAutoPrintKitchen(appContext, settings.autoPrintKitchen)
            }
            if (settings.tablesEnabled != previous.tablesEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveTablesEnabled(appContext, settings.tablesEnabled)
            }
            if (settings.scaleEnabled != previous.scaleEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveScaleEnabled(appContext, settings.scaleEnabled)
            }
            if (settings.scaleUsbAddress != previous.scaleUsbAddress) {
                com.chaslay.pos.util.PosLocalPrefs.saveScaleUsbAddress(appContext, settings.scaleUsbAddress)
            }
            if (settings.retailDineInEnabled != previous.retailDineInEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRetailDineInEnabled(appContext, settings.retailDineInEnabled)
            }
            if (settings.retailTakeawayEnabled != previous.retailTakeawayEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRetailTakeawayEnabled(appContext, settings.retailTakeawayEnabled)
            }
            if (settings.retailDeliveryEnabled != previous.retailDeliveryEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRetailDeliveryEnabled(appContext, settings.retailDeliveryEnabled)
            }
            if (settings.expressPayPlacement != previous.expressPayPlacement) {
                com.chaslay.pos.util.PosLocalPrefs.saveExpressPayPlacement(appContext, settings.expressPayPlacement)
            }
            val afterSaleGoToOrders = _uiState.value.afterSaleGoToOrders
            val previousAfterSaleGoToOrders =
                com.chaslay.pos.util.PosLocalPrefs.readAfterSaleGoToOrders(appContext)
            if (afterSaleGoToOrders != previousAfterSaleGoToOrders) {
                com.chaslay.pos.util.PosLocalPrefs.writeAfterSaleGoToOrders(appContext, afterSaleGoToOrders)
            }
            if (settings.expressEnabled != previous.expressEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveExpressCheckoutEnabled(appContext, settings.expressEnabled)
            }
            if (settings.retailCashTenderDialogEnabled != previous.retailCashTenderDialogEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRetailCashTenderDialogEnabled(
                    appContext,
                    settings.retailCashTenderDialogEnabled
                )
            }
            if (settings.retailWeighedCustomEntryEnabled != previous.retailWeighedCustomEntryEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRetailWeighedCustomEntryEnabled(
                    appContext,
                    settings.retailWeighedCustomEntryEnabled
                )
            }
            if (settings.restaurantWeighedCustomEntryEnabled != previous.restaurantWeighedCustomEntryEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveRestaurantWeighedCustomEntryEnabled(
                    appContext,
                    settings.restaurantWeighedCustomEntryEnabled
                )
            }
            if (settings.courseSendMode != previous.courseSendMode) {
                com.chaslay.pos.util.PosLocalPrefs.saveCourseSendMode(appContext, settings.courseSendMode)
            }
            if (settings.adyenTerminalEnabled != previous.adyenTerminalEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveAdyenTerminalEnabled(
                    appContext,
                    settings.adyenTerminalEnabled
                )
            }
            if (settings.terminalEnabled != previous.terminalEnabled) {
                com.chaslay.pos.util.PosLocalPrefs.saveTerminalTenderEnabled(
                    appContext,
                    settings.terminalEnabled
                )
            }
            settingsRepository.saveSettings(settings)
            currentSettings = settings
            val terminalSync = if (previous.terminalSyncPayloadChanged(settings)) {
                runCatching { terminalSyncRepository.pushLocalTerminalOnly() }
                    .getOrDefault(com.chaslay.pos.sync.TerminalSyncResult())
            } else {
                com.chaslay.pos.sync.TerminalSyncResult(skipped = true)
            }
            val syncNote = when {
                terminalSync.skipped -> null
                terminalSync.error != null -> " · terminal sync failed"
                terminalSync.pushed -> " · terminal synced to panel"
                else -> null
            }
            _uiState.update {
                it.copy(message = "Settings saved${syncNote ?: ""}")
            }
            syncMonitoredScaleUsbAddress()
            refreshScaleConnectionState()
        }
    }

    private fun buildSettingsFromState(): BusinessSettingsEntity {
        val state = _uiState.value
        return currentSettings.copy(
            businessName = state.businessName,
            vatNumber = state.vatNumber,
            address = state.address,
            phone = state.phone,
            email = state.email,
            website = state.website,
            defaultCurrency = state.defaultCurrency,
            currencySymbol = state.currencySymbol,
            defaultLanguage = state.language.code,
            tapToPayEnabled = state.tapToPayEnabled,
            adyenTerminalEnabled = state.adyenTerminalEnabled,
            adyenTerminalId = state.adyenTerminalId,
            adyenApiKey = state.adyenApiKey,
            adyenClientId = state.adyenClientId,
            adyenMerchantAccount = state.adyenMerchantAccount,
            adyenLiveEnvironment = state.adyenLiveEnvironment,
            adyenLiveRegion = state.adyenLiveRegion,
            adyenUseLegacyEndpoint = state.adyenUseLegacyEndpoint,
            roundingStep = state.roundingStep.toDoubleOrNull()?.takeIf { it > 0.0 } ?: 0.05,
            openHour = state.openHour.toIntOrNull()?.coerceIn(0, 23) ?: 10,
            openMinute = state.openMinute.toIntOrNull()?.coerceIn(0, 59) ?: 0,
            closeHour = state.closeHour.toIntOrNull()?.coerceIn(0, 23) ?: 22,
            closeMinute = state.closeMinute.toIntOrNull()?.coerceIn(0, 59) ?: 0,
            cashEnabled = state.cashEnabled,
            cardEnabled = state.cardEnabled,
            terminalEnabled = state.terminalEnabled,
            expressEnabled = state.expressEnabled,
            expressPayPlacement = ExpressPayPlacement.toCheckoutValue(state.expressPayPlacement),
            retailCashTenderDialogEnabled = state.retailCashTenderDialogEnabled,
            giftCardsEnabled = state.giftCardsEnabled,
            invoiceEnabled = state.invoiceEnabled,
            // POS Settings wins when staff change toggles locally.
            paymentMethodsManagedByCloud = state.paymentMethodsManagedByCloud,
            printerPrintReceipts = state.printerPrintReceipts,
            printerPrintReports = state.printerPrintReports,
            printerPrintKitchen = state.printerPrintKitchen,
            kitchenPrinterPrintKitchen = state.kitchenPrinterPrintKitchen,
            dineInVatRate = state.dineInVatRate.toDoubleOrNull() ?: 8.1,
            takeawayVatRate = state.takeawayVatRate.toDoubleOrNull() ?: 2.6,
            vatIncludedInPrice = state.vatIncludedInPrice,
            printerMacAddress = state.selectedPrinter?.address,
            printerName = state.selectedPrinter?.name,
            kitchenPrinterMacAddress = state.selectedKitchenPrinter?.address,
            kitchenPrinterName = state.selectedKitchenPrinter?.name,
            receiptHeader = state.receiptHeader,
            receiptFooter = state.receiptFooter,
            kitchenTicketHeader = state.kitchenTicketHeader,
            kitchenTicketFooter = state.kitchenTicketFooter,
            receiptShowVatTable = state.receiptShowVatTable,
            receiptShowStaffLine = state.receiptShowStaffLine,
            receiptShowQrCode = state.receiptShowQrCode,
            receiptDeliveryDirectionsQr = state.receiptDeliveryDirectionsQr,
            adyenReceiptDigitalOnly = state.adyenReceiptDigitalOnly,
            autoPrintReceipt = state.autoPrintReceipt,
            autoPrintKitchen = state.autoPrintKitchen,
            kitchenLargeItemText = state.kitchenLargeItemText,
            kitchenLargeHeaderText = state.kitchenLargeHeaderText,
            kitchenItemTextScale = state.kitchenItemTextScale.coerceIn(1, 3),
            kitchenHeaderTextScale = state.kitchenHeaderTextScale.coerceIn(1, 3),
            logoUri = state.logoUri,
            receiptTemplateName = state.receiptTemplateName,
            posMode = state.posMode,
            coursesEnabled = state.coursesEnabled,
            courseSendMode = state.courseSendMode.toStorageKey(),
            tablesEnabled = state.tablesEnabled,
            retailDineInEnabled = state.retailDineInEnabled,
            retailTakeawayEnabled = state.retailTakeawayEnabled,
            retailDeliveryEnabled = state.retailDeliveryEnabled,
            retailWeighedCustomEntryEnabled = state.retailWeighedCustomEntryEnabled,
            restaurantWeighedCustomEntryEnabled = state.restaurantWeighedCustomEntryEnabled,
            reservationsEnabled = state.reservationsEnabled,
            requireTableForDineIn = state.requireTableForDineIn,
            trackCoversFromSeatingPlan = state.trackCoversFromSeatingPlan,
            floorSyncEnabled = state.floorSyncEnabled,
            floorDeviceRole = state.floorDeviceRole.apiValue,
            floorConnectionMode = state.floorConnectionMode.apiValue,
            mainPosLanUrl = state.mainPosLanUrl.trim(),
            scaleEnabled = state.scaleEnabled,
            scaleUsbAddress = state.scaleUsbAddress?.trim()?.takeIf { it.isNotEmpty() }
        )
    }

    fun updateScaleEnabled(enabled: Boolean) = _uiState.update { it.copy(scaleEnabled = enabled) }

    fun selectScaleDevice(address: String) = _uiState.update {
        it.copy(scaleUsbAddress = address, message = "Scale device selected — tap Save")
    }

    fun selectScaleDeviceAndSave(address: String) {
        fun applySelection() {
            _uiState.update {
                it.copy(
                    scaleUsbAddress = address,
                    scaleEnabled = true,
                    message = "Scale selected — saving…"
                )
            }
            syncMonitoredScaleUsbAddress()
            refreshScaleConnectionState()
            saveSettings()
        }
        if (scaleService.hasPermission(address)) {
            applySelection()
            return
        }
        scaleService.requestPermission(address) { granted ->
            _uiState.update { it.copy(scaleDevices = scaleService.listDevices()) }
            refreshScaleConnectionState()
            if (granted) {
                applySelection()
            } else {
                _uiState.update { it.copy(message = "USB permission denied") }
            }
        }
    }

    fun displayScaleUsbAddress(address: String?): String {
        val trimmed = address?.trim().orEmpty()
        if (trimmed.isEmpty()) return ""
        return scaleService.displayNameForAddress(trimmed) ?: trimmed
    }

    fun scanScaleUsbDevices() {
        val devices = scaleService.listDevices()
        _uiState.update {
            it.copy(
                scaleDevices = devices,
                message = when {
                    devices.isEmpty() ->
                        "No USB scale found — connect Aclas OS6X via USB OTG"
                    devices.size == 1 ->
                        "Scale found — connecting…"
                    else ->
                        "${devices.size} scale device(s) found — tap one below to connect"
                }
            )
        }
        if (devices.size == 1) {
            selectScaleDeviceAndSave(devices.first().stableAddress)
        } else {
            refreshScaleConnectionState()
        }
    }

    fun testScaleReading() {
        val address = _uiState.value.scaleUsbAddress?.trim().orEmpty()
        if (address.isBlank()) {
            _uiState.update { it.copy(message = "Select a scale USB device first") }
            return
        }
        syncMonitoredScaleUsbAddress()
        if (!scaleService.hasPermission(address)) {
            usbPrinterManager.requestMonitoredScalePermissionFromSettings(address) { granted ->
                refreshScaleConnectionState()
                if (granted) {
                    performTestScaleReading(address)
                } else {
                    _uiState.update {
                        it.copy(
                            scaleTestReading = null,
                            message = appContext.getString(R.string.scale_usb_permission_required)
                        )
                    }
                }
            }
            return
        }
        performTestScaleReading(address)
    }

    private fun performTestScaleReading(address: String) {
        viewModelScope.launch {
            scaleService.readOnce(address)
                .onSuccess { reading ->
                    _uiState.update {
                        it.copy(
                            scaleTestReading = com.chaslay.pos.scale.AclasScaleProtocol.formatWeight(reading.weightKg),
                            scaleReachability = true,
                            scaleLastProbeAtMs = System.currentTimeMillis(),
                            message = "Scale reading OK"
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            scaleTestReading = null,
                            scaleReachability = false,
                            scaleLastProbeAtMs = System.currentTimeMillis(),
                            message = error.message ?: "Scale test failed"
                        )
                    }
                }
        }
    }
}
