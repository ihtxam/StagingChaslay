package com.chaslay.pos.data.repository

import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.remote.ReceiptApi
import com.chaslay.pos.data.remote.dto.ReceiptEmailRequest
import com.chaslay.pos.data.remote.dto.ReceiptItemDto
import com.chaslay.pos.data.remote.dto.ReceiptPublishRequest
import com.chaslay.pos.data.remote.dto.ReceiptPublishResponse
import com.chaslay.pos.data.remote.dto.ReceiptTenderDto
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PaymentTenderNotes
import com.chaslay.pos.domain.model.ServiceType
import com.google.gson.Gson
import com.google.gson.JsonObject
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

object ReceiptPublicUrls {
    private const val DEFAULT_BASE = "https://pay.chaslay.com/receipt"

    fun normalizeBase(raw: String): String {
        var base = raw.trim().trimEnd('/')
            .replace(Regex("chasly\\.com", RegexOption.IGNORE_CASE), "chaslay.com")
        if (Regex("^https?://app\\.", RegexOption.IGNORE_CASE).containsMatchIn(base)) {
            base = base.replace(Regex("^https?://app\\.", RegexOption.IGNORE_CASE), "https://pay.")
        }
        if (base.isBlank()) base = DEFAULT_BASE
        if (base.endsWith("/receipts", ignoreCase = true)) {
            base = base.dropLast("/receipts".length) + "/receipt"
        } else if (!base.endsWith("/receipt", ignoreCase = true)) {
            base = "$base/receipt"
        }
        return base
    }

    fun build(receiptBaseUrl: String, saleRef: String): String {
        return "${normalizeBase(receiptBaseUrl)}/$saleRef"
    }
}

@Singleton
class ReceiptRepository @Inject constructor(
    private val receiptApi: ReceiptApi
) {
    private val gson = Gson()
    fun buildPublicUrl(transactionId: String, settings: BusinessSettingsEntity): String {
        return ReceiptPublicUrls.build(settings.receiptBaseUrl, transactionId)
    }

    suspend fun publishReceipt(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity
    ): String {
        val fallbackUrl = transaction.receiptUrl ?: buildPublicUrl(transaction.id, settings)
        val itemDiscountTotal = items.sumOf { it.lineDiscountPerUnit * it.quantity }
        return runCatching {
            val response = receiptApi.publishReceipt(
                buildPublishRequest(transaction, items, settings, itemDiscountTotal)
            )
            response.url?.takeIf { it.isNotBlank() } ?: fallbackUrl
        }.getOrElse { error ->
            Log.w(TAG, "Receipt publish failed, using fallback URL", error)
            fallbackUrl
        }
    }

    suspend fun publishPendingReceipt(
        transactionId: String,
        cart: CartSummary,
        total: Double,
        currency: String,
        settings: BusinessSettingsEntity
    ): String {
        val fallbackUrl = buildPublicUrl(transactionId, settings)
        val txNumber = cart.orderNumber?.trim()?.takeIf { it.isNotBlank() } ?: transactionId.takeLast(8)
        return runCatching {
            val response = receiptApi.publishReceipt(
                ReceiptPublishRequest(
                    id = transactionId,
                    transactionNumber = txNumber,
                    total = total,
                    currency = currency,
                    paymentMethod = "PENDING",
                    businessName = settings.businessName,
                    createdAt = System.currentTimeMillis(),
                    fulfillmentChannel = channelFromFulfillment(cart.fulfillmentType, cart.serviceType),
                    pickupTimeMs = cart.pickupTimeMs,
                    subtotal = cart.subtotal,
                    taxTotal = cart.taxTotal,
                    itemDiscountTotal = cart.itemDiscountTotal,
                    items = cart.items.map { item ->
                        ReceiptItemDto(
                            productName = item.productName,
                            variantName = item.variantName,
                            quantity = item.quantity,
                            lineTotal = item.lineTotal,
                            lineSubtotal = item.lineSubtotal,
                            lineDiscount = item.lineDiscount,
                            unitPrice = item.unitPrice
                        )
                    }
                )
            )
            response.url?.takeIf { it.isNotBlank() } ?: fallbackUrl
        }.getOrElse { error ->
            Log.w(TAG, "Pending receipt publish failed, using fallback URL", error)
            fallbackUrl
        }
    }

    /** Upload receipt to server; fails if the API rejects the request (no silent fallback). */
    suspend fun ensureReceiptPublished(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity
    ): Result<String> = runCatching {
        val itemDiscountTotal = items.sumOf { it.lineDiscountPerUnit * it.quantity }
        val response = receiptApi.publishReceipt(
            buildPublishRequest(transaction, items, settings, itemDiscountTotal)
        )
        val url = response.url?.takeIf { it.isNotBlank() }
            ?: buildPublicUrl(
                response.id?.takeIf { it.isNotBlank() } ?: transaction.id,
                settings
            )
        url
    }.recoverCatching { error ->
        throw Exception(apiErrorMessage(error, "Could not upload receipt to server"), error)
    }

    suspend fun publishInvoiceSale(
        clientId: String,
        orderNumber: String,
        cart: CartSummary,
        total: Double,
        discountAmount: Double,
        tipAmount: Double,
        currency: String,
        settings: BusinessSettingsEntity,
        customerName: String?,
        customerPhone: String?,
        customerAddress: String?
    ): ReceiptPublishResponse {
        return receiptApi.publishReceipt(
            ReceiptPublishRequest(
                id = clientId,
                transactionNumber = orderNumber,
                total = total,
                currency = currency,
                paymentMethod = "invoice",
                businessName = settings.businessName,
                createdAt = System.currentTimeMillis(),
                fulfillmentChannel = channelFromFulfillment(cart.fulfillmentType, cart.serviceType),
                pickupTimeMs = cart.pickupTimeMs,
                subtotal = cart.subtotal,
                taxTotal = cart.taxTotal,
                discountAmount = discountAmount,
                itemDiscountTotal = cart.itemDiscountTotal,
                tipAmount = tipAmount.takeIf { it > 0.0 },
                items = cart.items.map { item ->
                    ReceiptItemDto(
                        productName = item.productName,
                        variantName = item.variantName,
                        quantity = item.quantity,
                        lineTotal = item.lineTotal,
                        lineSubtotal = item.lineSubtotal,
                        lineDiscount = item.lineDiscount,
                        unitPrice = item.unitPrice
                    )
                },
                customerName = customerName,
                customerPhone = customerPhone,
                shippingAddress = customerAddress
            )
        )
    }

    suspend fun sendReceiptEmail(
        receiptId: String,
        email: String,
        customerName: String? = null
    ): Result<String> = runCatching {
        val response = receiptApi.emailReceipt(
            receiptId = receiptId,
            body = ReceiptEmailRequest(email = email.trim(), customerName = customerName?.trim())
        )
        if (response.success) {
            response.message ?: "Receipt sent to $email"
        } else {
            error(response.message ?: "Could not send receipt email")
        }
    }.recoverCatching { error ->
        throw Exception(apiErrorMessage(error, "Could not send receipt email"), error)
    }

    private fun apiErrorMessage(error: Throwable, fallback: String): String {
        if (error is HttpException) {
            val raw = error.response()?.errorBody()?.string()
            if (!raw.isNullOrBlank()) {
                runCatching {
                    val json = gson.fromJson(raw, JsonObject::class.java)
                    json.get("message")?.asString?.takeIf { it.isNotBlank() }
                        ?: json.get("error")?.asString?.takeIf { it.isNotBlank() }
                }.getOrNull()?.let { return it }
            }
            return when (error.code()) {
                404 -> "Receipt not on server yet. Check network and API key, then try again."
                401 -> "Server rejected API key. Rebuild the app with the correct SYNC_API_KEY."
                502 -> "Receipt service unavailable. Try again in a moment."
                else -> "$fallback (HTTP ${error.code()})"
            }
        }
        return error.message ?: fallback
    }

    private fun buildPublishRequest(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        settings: BusinessSettingsEntity,
        itemDiscountTotal: Double
    ) = ReceiptPublishRequest(
        id = transaction.id,
        transactionNumber = transaction.transactionNumber,
        total = transaction.total,
        currency = transaction.currencyCode,
        paymentMethod = PaymentTenderNotes.methodKey(transaction.paymentMethod),
        cardReference = transaction.cardReference,
        businessName = settings.businessName,
        createdAt = transaction.createdAt,
        fulfillmentChannel = channelFromTransaction(transaction),
        pickupTimeMs = transaction.pickupTimeMs,
        subtotal = transaction.subtotal,
        taxTotal = transaction.taxTotal,
        discountAmount = transaction.discountAmount,
        itemDiscountTotal = itemDiscountTotal,
        tipAmount = transaction.tipAmount.takeIf { it > 0.0 },
        items = items.map { item ->
            ReceiptItemDto(
                productName = item.productName,
                variantName = item.variantName,
                quantity = item.quantity,
                lineTotal = item.lineTotal,
                lineSubtotal = item.lineSubtotal,
                lineDiscount = item.lineDiscountPerUnit * item.quantity,
                unitPrice = item.unitPrice
            )
        },
        paymentBreakdown = PaymentTenderNotes.parse(transaction.notes)
            .takeIf { it.size >= 2 }
            ?.map { ReceiptTenderDto(PaymentTenderNotes.methodKey(it.method), it.amount) }
    )

    private fun channelFromFulfillment(
        fulfillmentType: FulfillmentType,
        serviceType: ServiceType?
    ): String = when (fulfillmentType) {
        FulfillmentType.DELIVERY -> "delivery"
        FulfillmentType.DINE_IN -> "dine_in"
        FulfillmentType.PICKUP, FulfillmentType.WALK_IN ->
            if (serviceType == ServiceType.DINE_IN) "dine_in" else "takeaway"
    }

    private fun channelFromTransaction(tx: TransactionEntity): String {
        val notes = tx.notes.orEmpty()
        if (notes.contains("--- DELIVERY ---", ignoreCase = true)) return "delivery"
        if (tx.tableId != null || tx.serviceType == ServiceType.DINE_IN) return "dine_in"
        return "takeaway"
    }

    companion object {
        private const val TAG = "ReceiptRepository"
    }
}

