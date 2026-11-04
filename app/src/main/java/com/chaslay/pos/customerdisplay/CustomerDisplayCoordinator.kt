package com.chaslay.pos.customerdisplay

import android.content.Context
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.ui.pos.CheckoutState
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Native Sunmi customer display: cloud live state + rear Presentation + D3 line LCD.
 * No localhost Bridge — same device APIs as Reborn Print Bridge, embedded in the POS app.
 */
@Singleton
class CustomerDisplayCoordinator @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val repository: CustomerDisplayRepository,
    private val nativeDisplay: NativeCustomerDisplayManager,
    private val sunmiLcd: SunmiCustomerLcd,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val pushMutex = Mutex()
    @Volatile
    private var presentationAttempted = false

    fun close() {
        nativeDisplay.close()
    }

    fun publishFromPos(
        cart: CartSummary,
        settings: BusinessSettingsEntity,
        phase: CustomerDisplayPhase,
        receiptUrl: String? = null,
        thankYouTotal: Double? = null,
        checkout: CheckoutState = CheckoutState(),
    ) {
        if (!settings.cdsEnabled) return
        if (settings.cdsAccessToken.trim().isEmpty()) return

        val state = buildState(
            cart = cart,
            settings = settings,
            phase = phase,
            receiptUrl = receiptUrl,
            thankYouTotal = thankYouTotal,
            checkout = checkout,
        )

        scope.launch {
            pushMutex.withLock {
                runCatching { repository.pushLiveState(state) }
            }
            ensurePresentation(settings)
            updateLcd(state)
        }
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
        val merchandiseTotal = cart.merchandiseTotal(
            checkout.discountPercent,
            checkout.discountAmount,
        )
        val total = when {
            thankYou -> thankYouTotal ?: merchandiseTotal
            else -> merchandiseTotal
        }
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
            discount = cart.discountValue + checkout.discountAmount,
            tax = cart.taxTotal,
            total = total,
            phase = phase,
            receiptUrl = receiptUrl?.takeIf { thankYou },
            locale = locale,
            updatedAt = System.currentTimeMillis(),
        )
    }

    private fun ensurePresentation(settings: BusinessSettingsEntity) {
        val url = CdsPublicUrl.resolve(settings)
        if (url.endsWith("/cds/")) return
        if (!nativeDisplay.dualScreenAvailable(appContext)) return
        if (presentationAttempted && nativeDisplay.isOpen()) return
        presentationAttempted = true
        nativeDisplay.open(appContext, url)
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
}
