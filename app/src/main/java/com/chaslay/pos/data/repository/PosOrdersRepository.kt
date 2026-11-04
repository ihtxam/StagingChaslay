package com.chaslay.pos.data.repository

import android.content.Context
import com.chaslay.pos.R
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.PosOrdersApi
import com.chaslay.pos.data.remote.UpdatePaymentMethodRequest
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.SyncStatus
import com.chaslay.pos.util.parseApiErrorMessage
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PosOrdersRepository @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val posOrdersApi: PosOrdersApi,
    private val syncPreferences: SyncPreferences,
    private val transactionRepository: TransactionRepository,
) {
    suspend fun updatePaymentMethod(orderId: String, method: PaymentMethod): Result<Unit> {
        val apiKey = method.toPosApiPaymentKey()
            ?: return Result.failure(
                IllegalArgumentException(appContext.getString(R.string.order_payment_method_invalid_target))
            )
        return try {
            transactionRepository.updatePaymentMethod(orderId, method)
            syncPaymentMethodToCloudIfApplicable(orderId, apiKey)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(
                Exception(
                    parseApiErrorMessage(
                        e,
                        appContext.getString(R.string.order_payment_method_update_failed),
                    ),
                    e,
                )
            )
        }
    }

    private suspend fun syncPaymentMethodToCloudIfApplicable(orderId: String, apiKey: String) {
        val token = syncPreferences.getDashboardToken()?.trim().orEmpty()
        if (token.isBlank()) return
        val tx = transactionRepository.getTransaction(orderId)?.first ?: return
        if (tx.syncStatus != SyncStatus.SYNCED) return
        runCatching {
            posOrdersApi.updatePaymentMethod(
                "Bearer $token",
                orderId,
                UpdatePaymentMethodRequest(apiKey),
            )
        }
    }
}

fun PaymentMethod.toPosApiPaymentKey(): String? = when (this) {
    PaymentMethod.CASH -> "cash"
    PaymentMethod.CARD -> "card"
    PaymentMethod.ADYEN_TERMINAL -> "terminal"
    PaymentMethod.TAP_TO_PAY -> "express"
    PaymentMethod.INVOICE -> "invoice"
    else -> null
}

fun paymentMethodFromPosApiKey(key: String): PaymentMethod? = when (key.lowercase().replace('-', '_')) {
    "cash" -> PaymentMethod.CASH
    "card" -> PaymentMethod.CARD
    "terminal" -> PaymentMethod.ADYEN_TERMINAL
    "express" -> PaymentMethod.TAP_TO_PAY
    "invoice" -> PaymentMethod.INVOICE
    "bank_transfer", "bank" -> PaymentMethod.INVOICE
    else -> null
}

/** Completed/partially refunded local sales (not pay-later tab). Invoice sales may stay PENDING until paid. */
fun canEditOrderPayment(order: com.chaslay.pos.data.local.entity.TransactionEntity): Boolean {
    if (order.paymentMethod == PaymentMethod.PAY_LATER) return false
    return when (order.paymentStatus) {
        com.chaslay.pos.domain.model.PaymentStatus.COMPLETED,
        com.chaslay.pos.domain.model.PaymentStatus.PARTIALLY_REFUNDED -> true
        com.chaslay.pos.domain.model.PaymentStatus.PENDING ->
            order.paymentMethod == PaymentMethod.INVOICE
        else -> false
    }
}

val editablePaymentMethodsForHistory: List<PaymentMethod> = listOf(
    PaymentMethod.CASH,
    PaymentMethod.CARD,
    PaymentMethod.ADYEN_TERMINAL,
    PaymentMethod.TAP_TO_PAY,
    PaymentMethod.INVOICE,
)
