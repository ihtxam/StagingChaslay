package com.chaslay.pos.customerdisplay

import android.content.Context
import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.adjustTaxForOrderDiscount
import com.chaslay.pos.domain.model.computeLineTax
import com.chaslay.pos.domain.resolveBillDiscountAmount
import com.chaslay.pos.ui.pos.CheckoutState
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Native Sunmi customer display: cloud live state + rear Presentation + D3 line LCD.
 */
@Singleton
class CustomerDisplayCoordinator @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val repository: CustomerDisplayRepository,
    private val nativeDisplay: NativeCustomerDisplayManager,
    private val sunmiLcd: SunmiCustomerLcd,
    private val cdsConfigRepository: CdsConfigRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pushMutex = Mutex()
    @Volatile
    private var presentationAttempted = false
    @Volatile
    private var cachedBranding: CustomerDisplayBranding? = null
    @Volatile
    private var brandingSettingsKey: String = ""
    @Volatile
    private var deferredInitialOpen = true
    @Volatile
    private var localTargetUnavailable = false

    /** Cheap check for PosViewModel / till hot path — no I/O, no display bind, no state build. */
    fun isCdsActive(settings: BusinessSettingsEntity): Boolean {
        if (!settings.cdsEnabled) return false
        if (settings.cdsAccessToken.trim().isEmpty()) return false
        if (localTargetUnavailable) return false
        return mayHaveLocalCdsHardware()
    }

    fun close() {
        runCatching { nativeDisplay.close() }
            .onFailure { Log.w(TAG, "Customer display close failed", it) }
    }

    fun publishFromPos(
        cart: CartSummary,
        settings: BusinessSettingsEntity,
        phase: CustomerDisplayPhase,
        receiptUrl: String? = null,
        thankYouTotal: Double? = null,
        checkout: CheckoutState = CheckoutState(),
    ) {
        if (!isCdsActive(settings)) return

        scope.launch {
            runCatching {
                if (!resolveLocalCdsTarget()) {
                    localTargetUnavailable = true
                    return@launch
                }
                val state = buildState(
                    cart = cart,
                    settings = settings,
                    phase = phase,
                    receiptUrl = receiptUrl,
                    thankYouTotal = thankYouTotal,
                    checkout = checkout,
                )
                pushMutex.withLock {
                    runCatching { repository.pushLiveState(state) }
                        .onFailure { Log.w(TAG, "CDS cloud push failed", it) }
                }
                val branding = brandingFor(settings)
                if (deferredInitialOpen && nativeDisplay.hasSecondaryDisplay(appContext)) {
                    deferredInitialOpen = false
                    delay(FIRST_PRESENTATION_DELAY_MS)
                }
                withContext(Dispatchers.Main.immediate) {
                    runCatching { ensurePresentation(settings, state, branding) }
                        .onFailure { Log.e(TAG, "CDS presentation failed", it) }
                }
                runCatching { updateLcd(state) }
                    .onFailure { Log.w(TAG, "CDS LCD update failed", it) }
            }.onFailure { Log.e(TAG, "CDS publish failed", it) }
        }
    }

    /** Secondary HDMI/rear display or Sunmi line-LCD models only — no service bind. */
    private fun mayHaveLocalCdsHardware(): Boolean =
        nativeDisplay.hasSecondaryDisplay(appContext) || sunmiLcd.isLikelyCustomerLcdDevice()

    /** Confirms local CDS hardware; Sunmi LCD probe runs on IO (may bind service once). */
    private suspend fun resolveLocalCdsTarget(): Boolean {
        if (nativeDisplay.hasSecondaryDisplay(appContext)) return true
        if (!sunmiLcd.isLikelyCustomerLcdDevice()) return false
        return withContext(Dispatchers.IO) {
            sunmiLcd.customerLcdAvailable(appContext)
        }
    }

    private suspend fun brandingFor(settings: BusinessSettingsEntity): CustomerDisplayBranding {
        val key = "${settings.cdsAccessToken}|${settings.cdsMerchantSlug}|${settings.businessName}|${settings.logoUri}"
        if (cachedBranding != null && brandingSettingsKey == key) {
            return cachedBranding!!
        }
        val loaded = cdsConfigRepository.loadBranding(settings)
        cachedBranding = loaded
        brandingSettingsKey = key
        return loaded
    }

    private fun buildState(
        cart: CartSummary,
        settings: BusinessSettingsEntity,
        phase: CustomerDisplayPhase,
        receiptUrl: String?,
        thankYouTotal: Double?,
        checkout: CheckoutState,
    ): CustomerDisplayState {
        val currency = settings.defaultCurrency.ifBlank { "CHF" }
        val thankYou = phase == CustomerDisplayPhase.thankyou
        val billDiscount = resolveBillDiscountAmount(cart, checkout.discountPercent, checkout.discountAmount)
        val merchandiseTotal = cart.merchandiseTotal(checkout.discountPercent, checkout.discountAmount)
        val total = when {
            thankYou -> thankYouTotal ?: merchandiseTotal
            else -> merchandiseTotal
        }
        val rawTax = cart.items.sumOf { item ->
            computeLineTax(item.lineSubtotal, item.taxRate, cart.vatIncludedInPrice)
        }
        val tax = adjustTaxForOrderDiscount(
            rawTax,
            cart.netSubtotal,
            billDiscount,
            cart.vatIncludedInPrice,
            cart.vatAfterDiscount,
        )
        val lines = if (thankYou) {
            emptyList()
        } else {
            cart.items.map { item ->
                val qty = if (item.isWeighed) 1.0 else item.quantity.toDouble()
                CustomerDisplayLine(
                    name = item.productName,
                    qty = qty,
                    lineTotal = item.lineTotal,
                    modifiers = item.modifierSummary().takeIf { it.isNotBlank() },
                )
            }
        }
        val locale = when (settings.defaultLanguage.lowercase()) {
            "fr", "de", "en" -> settings.defaultLanguage.lowercase()
            else -> null
        }
        return CustomerDisplayState(
            merchantName = settings.businessName.takeIf { it.isNotBlank() },
            currency = currency,
            lines = lines,
            subtotal = cart.subtotal,
            discount = cart.discountValue + billDiscount,
            tax = tax,
            total = total,
            phase = phase,
            receiptUrl = receiptUrl?.takeIf { thankYou },
            locale = locale,
            updatedAt = System.currentTimeMillis(),
        )
    }

    private fun ensurePresentation(
        settings: BusinessSettingsEntity,
        state: CustomerDisplayState,
        branding: CustomerDisplayBranding,
    ) {
        if (!nativeDisplay.hasSecondaryDisplay(appContext)) return
        if (presentationAttempted) {
            if (nativeDisplay.isOpen()) {
                runCatching { nativeDisplay.update(state, branding) }
                    .onFailure { Log.w(TAG, "CDS presentation update failed", it) }
            }
            return
        }
        val opened = nativeDisplay.ensureOpen(appContext)
        if (opened.ok) {
            presentationAttempted = true
            runCatching { nativeDisplay.update(state, branding) }
                .onFailure { Log.w(TAG, "CDS presentation update failed", it) }
        } else {
            Log.w(TAG, "CDS presentation not opened: ${opened.message}")
        }
    }

    private fun updateLcd(state: CustomerDisplayState) {
        if (!sunmiLcd.customerLcdAvailable(appContext)) return
        val lcdLines = formatSunmiLcdLines(
            phase = state.phase,
            currency = state.currency,
            total = state.total,
            lines = state.lines,
            merchantName = state.merchantName,
        )
        if (lcdLines.clear) {
            sunmiLcd.clearCustomerLcd(appContext)
        } else {
            sunmiLcd.showCustomerLcd(appContext, lcdLines.topText, lcdLines.bottomText)
        }
    }

    private companion object {
        const val TAG = "CustomerDisplayCoord"
        const val FIRST_PRESENTATION_DELAY_MS = 500L
    }
}
