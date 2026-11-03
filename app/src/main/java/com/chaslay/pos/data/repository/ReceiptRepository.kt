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
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.roundMoney
import com.google.gson.Gson
import com.google.gson.JsonObject
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

object ReceiptPublicUrls {
    private const val DEFAULT_BASE = "https://pay.rebornsense.com/receipt"

    fun normalizeBase(raw: String): String {
        var base = raw.trim().trimEnd('/')
            .replace(Regex("chasly\\.com", RegexOption.IGNORE_CASE), "rebornsense.com")
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
    data class PublishedReceipt(
        val publicUrl: String,
        /** Backend order UUID when publish succeeded (preferred for email lookup). */
        val serverOrderId: String? = null
    )

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
        settings: BusinessSettingsEntity,
        splitPartCount: Int? = null
    ): Result<PublishedReceipt> = runCatching {
        val itemDiscountTotal = items.sumOf { it.lineDiscountPerUnit * it.quantity }
        val response = receiptApi.publishReceipt(
            buildPublishRequest(
                transaction = transaction,
                items = items,
                settings = settings,
                itemDiscountTotal = itemDiscountTotal,
                splitPartCount = splitPartCount
            )
        )
        val serverOrderId = response.id?.takeIf { it.isNotBlank() }
        val url = response.url?.takeIf { it.isNotBlank() }
            ?: buildPublicUrl(serverOrderId ?: transaction.id, settings)
        PublishedReceipt(publicUrl = url, serverOrderId = serverOrderId)
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
        val txnNumber = orderNumber.trim().takeIf { it.isNotEmpty() }?.let { raw ->
            if (raw.startsWith("#") || raw.startsWith("D-", ignoreCase = true)) {
                "WP-${clientId.replace("-", "").take(16).uppercase()}"
            } else {
                raw
            }
        } ?: clientId
        return receiptApi.publishReceipt(
            ReceiptPublishRequest(
                id = clientId,
                transactionNumber = txnNumber,
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
        customerName: String? = null,
        orderNumber: String? = null,
        amount: Double? = null
    ): Result<String> = runCatching {
        val response = receiptApi.emailReceipt(
            receiptId = receiptId,
            body = ReceiptEmailRequest(
                email = email.trim(),
                customerName = customerName?.trim(),
                orderNumber = orderNumber?.trim()?.takeIf { it.isNotEmpty() },
                transactionNumber = orderNumber?.trim()?.takeIf { it.isNotEmpty() },
                amount = amount?.takeIf { it > 0.001 }
            )
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
        itemDiscountTotal: Double,
        splitPartCount: Int? = null
    ): ReceiptPublishRequest {
        val methodKey = PaymentTenderNotes.methodKey(transaction.paymentMethod)
        val payLater =
            methodKey == "pay_later" || methodKey == "invoice" ||
                transaction.paymentStatus != PaymentStatus.COMPLETED
        val receiptItems = receiptLineItemsForPublish(transaction, items)
        return ReceiptPublishRequest(
            id = transaction.id,
            transactionNumber = transaction.transactionNumber,
            total = transaction.total.coerceAtLeast(0.0),
            currency = transaction.currencyCode,
            paymentMethod = methodKey,
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
            roundingAmount = transaction.roundingAmount.takeIf { kotlin.math.abs(it) > 0.001 },
            masterOrderId = transaction.masterOrderId?.trim()?.takeIf { it.isNotEmpty() },
            splitCheckNumber = transaction.splitCheckNumber,
            splitPartCount = splitPartCount?.takeIf { it > 1 },
            staffName = transaction.userName.takeIf { it.isNotBlank() },
            paymentStatus = if (payLater) "awaiting_payment" else "completed",
            status = if (payLater) "preparing" else "completed",
            tableId = transaction.tableId?.toString(),
            notes = transaction.notes,
            adyenCustomerReceiptJson = transaction.adyenCustomerReceiptJson,
            adyenCashierReceiptJson = transaction.adyenCashierReceiptJson,
            items = receiptItems,
            paymentBreakdown = PaymentTenderNotes.parse(transaction.notes)
                .takeIf { it.size >= 2 }
                ?.map { ReceiptTenderDto(PaymentTenderNotes.methodKey(it.method), it.amount) }
                ?: if (!payLater && transaction.total > 0.001) {
                    listOf(ReceiptTenderDto(methodKey, transaction.total))
                } else {
                    null
                }
        )
    }

    /**
     * Match WebPOS split receipts: scale lines to the paid share, and never publish an empty cart
     * when the transaction total is positive (backend rejects itemCount === 0).
     */
    private fun receiptLineItemsForPublish(
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>
    ): List<ReceiptItemDto> {
        if (items.isEmpty() && transaction.total > 0.001) {
            return listOf(
                ReceiptItemDto(
                    productName = "Sale",
                    quantity = 1,
                    lineTotal = transaction.total,
                    lineSubtotal = transaction.subtotal.coerceAtLeast(0.0),
                    unitPrice = transaction.total
                )
            )
        }
        val merchandiseTotal = items.sumOf { it.lineTotal }
        val paidMerchandise = roundMoney(
            (transaction.total - transaction.tipAmount - transaction.roundingAmount).coerceAtLeast(0.0)
        )
        val scale = when {
            merchandiseTotal <= 0.001 || paidMerchandise <= 0.001 -> 1.0
            merchandiseTotal > paidMerchandise + 0.05 -> paidMerchandise / merchandiseTotal
            else -> 1.0
        }
        return items.map { item ->
            ReceiptItemDto(
                productName = item.productName,
                productClientId = item.productId?.takeIf { it > 0L }?.toString(),
                variantName = item.variantName,
                quantity = item.quantity.coerceAtLeast(1),
                lineTotal = roundMoney(item.lineTotal * scale),
                lineSubtotal = roundMoney(item.lineSubtotal * scale),
                lineDiscount = roundMoney(item.lineDiscountPerUnit * item.quantity * scale),
                unitPrice = roundMoney(item.unitPrice * scale)
            )
        }
    }

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

