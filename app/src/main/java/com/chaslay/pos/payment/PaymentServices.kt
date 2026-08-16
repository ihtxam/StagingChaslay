package com.chaslay.pos.payment

import android.app.Activity
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.payment.taptopay.AdyenTapToPayService
import javax.inject.Inject
import javax.inject.Singleton

sealed class PaymentResult {
    data class Success(
        val reference: String? = null,
        val poiTimestamp: String? = null,
        val method: PaymentMethod,
        val adyenCustomerReceipt: AdyenTerminalReceipt? = null,
        val adyenCashierReceipt: AdyenTerminalReceipt? = null
    ) : PaymentResult()
    data class Failure(val message: String) : PaymentResult()
    data object Cancelled : PaymentResult()
}

@Singleton
class PaymentOrchestrator @Inject constructor(
    private val tapToPayService: TapToPayService,
    private val adyenTerminalService: AdyenTerminalService
) {
    suspend fun processAdyenTerminalPayment(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult = adyenTerminalService.processPayment(amount, currencyCode, settings)

    suspend fun processCardPayment(
        activity: Activity?,
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        return when {
            settings.tapToPayEnabled -> {
                if (activity == null) {
                    PaymentResult.Failure("Tap to Pay requires an active checkout screen.")
                } else {
                    tapToPayService.processPayment(activity, amount, currencyCode)
                }
            }
            settings.cardEnabled -> {
                PaymentResult.Success(
                    reference = "CARD-${System.currentTimeMillis()}",
                    method = PaymentMethod.CARD
                )
            }
            else -> PaymentResult.Failure("No card payment method configured. Enable card payments in Settings.")
        }
    }
}

@Singleton
class TapToPayService @Inject constructor(
    private val adyenTapToPayService: AdyenTapToPayService
) {
    /** True when the device has NFC. Real attestation is enforced by the SDK at run time. */
    fun isSupported(): Boolean = adyenTapToPayService.isSupported()

    /**
     * Runs an Adyen Tap to Pay on Android (SoftPOS) sale — the phone's NFC reader
     * acts as the card terminal. Requires a Play-Integrity-compliant device and
     * Adyen SoftPOS enablement; returns [PaymentResult.Failure] otherwise.
     */
    suspend fun processPayment(activity: Activity, amount: Double, currencyCode: String): PaymentResult =
        adyenTapToPayService.processPayment(activity, amount, currencyCode)
}

@Singleton
class AdyenTerminalService @Inject constructor(
    private val adyenTerminalClient: AdyenTerminalClient
) {
    suspend fun processPayment(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        return when (val response = adyenTerminalClient.sendPaymentRequest(amount, currencyCode, settings)) {
            is AdyenTerminalResponse.Approved -> PaymentResult.Success(
                reference = response.reference,
                poiTimestamp = response.poiTimestamp,
                method = PaymentMethod.ADYEN_TERMINAL,
                adyenCustomerReceipt = response.customerReceipt,
                adyenCashierReceipt = response.cashierReceipt
            )
            is AdyenTerminalResponse.Cancelled -> PaymentResult.Cancelled
            is AdyenTerminalResponse.Declined -> PaymentResult.Failure(response.message)
            is AdyenTerminalResponse.Error -> PaymentResult.Failure(response.message)
        }
    }

    suspend fun testConnection(settings: BusinessSettingsEntity): String {
        val result = adyenTerminalClient.testConnection(settings)
        return result.message
    }

    fun cancelActivePayment() {
        adyenTerminalClient.cancelActiveRequest()
    }

    suspend fun showDigitalReceipt(
        settings: BusinessSettingsEntity,
        items: List<com.chaslay.pos.domain.model.CartItem>,
        total: Double,
        currencySymbol: String,
        receiptUrl: String
    ) {
        val xml = AdyenDisplayReceiptBuilder.buildVirtualReceiptXml(
            businessName = settings.businessName,
            items = items,
            total = total,
            currencySymbol = currencySymbol,
            receiptUrl = receiptUrl
        )
        val base64 = android.util.Base64.encodeToString(
            xml.toByteArray(Charsets.UTF_8),
            android.util.Base64.NO_WRAP
        )
        adyenTerminalClient.sendDisplayReceipt(settings, base64)
    }

    suspend fun processRefund(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity,
        originalTransactionId: String,
        originalTimestamp: String
    ): PaymentResult {
        return when (
            val response = adyenTerminalClient.sendRefundRequest(
                amount = amount,
                currencyCode = currencyCode,
                settings = settings,
                originalTransactionId = originalTransactionId,
                originalTimestamp = originalTimestamp
            )
        ) {
            is AdyenTerminalResponse.Approved -> PaymentResult.Success(
                reference = response.reference,
                method = PaymentMethod.ADYEN_TERMINAL
            )
            is AdyenTerminalResponse.Cancelled -> PaymentResult.Cancelled
            is AdyenTerminalResponse.Declined -> PaymentResult.Failure(response.message)
            is AdyenTerminalResponse.Error -> PaymentResult.Failure(response.message)
        }
    }

    suspend fun processUnreferencedRefund(
        amount: Double,
        currencyCode: String,
        settings: BusinessSettingsEntity
    ): PaymentResult {
        return when (
            val response = adyenTerminalClient.sendUnreferencedRefundRequest(
                amount = amount,
                currencyCode = currencyCode,
                settings = settings
            )
        ) {
            is AdyenTerminalResponse.Approved -> PaymentResult.Success(
                reference = response.reference,
                method = PaymentMethod.ADYEN_TERMINAL
            )
            is AdyenTerminalResponse.Cancelled -> PaymentResult.Cancelled
            is AdyenTerminalResponse.Declined -> PaymentResult.Failure(response.message)
            is AdyenTerminalResponse.Error -> PaymentResult.Failure(response.message)
        }
    }
}

@Singleton
class CashPaymentService @Inject constructor() {
    fun processPayment(): PaymentResult =
        PaymentResult.Success(method = PaymentMethod.CASH)
}
