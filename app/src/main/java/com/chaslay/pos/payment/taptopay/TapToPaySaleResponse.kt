package com.chaslay.pos.payment.taptopay

import com.chaslay.pos.payment.AdyenPaymentReceiptParser
import com.chaslay.pos.payment.AdyenTerminalReceipt
import com.google.gson.Gson
import com.google.gson.JsonObject

/**
 * The parts of a Tap to Pay sale result the POS needs after the SDK reports back.
 *
 * The SDK hands us `PaymentResult.data`: a serialized Terminal API response, the
 * same shape the networked terminal returns. Treating it as an opaque reference
 * string loses the POI transaction id (needed to refund) and the printable
 * receipt blocks, so it is parsed here with the terminal path's own parser.
 */
data class TapToPaySaleResponse(
    val poiTransactionId: String?,
    val poiTimestamp: String?,
    val customerReceipt: AdyenTerminalReceipt?,
    val cashierReceipt: AdyenTerminalReceipt?,
)

object TapToPaySaleResponseParser {
    private val gson = Gson()

    /**
     * Accepts the full `SaleToPOIResponse` envelope, a bare `PaymentResponse`, or
     * the `TransactionStatusResponse` wrapper returned when recovering a sale.
     * Returns null when [data] is absent or not the expected shape; callers treat
     * that as "approved but without receipt detail" rather than a failure.
     */
    fun parse(data: String?): TapToPaySaleResponse? {
        if (data.isNullOrBlank()) return null
        return runCatching {
            val root = gson.fromJson(data, JsonObject::class.java) ?: return null
            val paymentResponse = paymentResponseFrom(root) ?: return null
            val poiTx = paymentResponse
                .getAsJsonObject("POIData")
                ?.getAsJsonObject("POITransactionID")
            val (customer, cashier) = AdyenPaymentReceiptParser.parsePaymentReceipts(paymentResponse)
            TapToPaySaleResponse(
                poiTransactionId = poiTx?.get("TransactionID")?.asString,
                poiTimestamp = poiTx?.get("TimeStamp")?.asString,
                customerReceipt = customer,
                cashierReceipt = cashier,
            )
        }.getOrNull()
    }

    /** True when the Terminal API `Response.Result` says the sale succeeded. */
    fun isApproved(data: String?): Boolean {
        if (data.isNullOrBlank()) return false
        return runCatching {
            val root = gson.fromJson(data, JsonObject::class.java) ?: return false
            val paymentResponse = paymentResponseFrom(root) ?: return false
            paymentResponse.getAsJsonObject("Response")
                ?.get("Result")?.asString
                ?.equals("Success", ignoreCase = true) == true
        }.getOrDefault(false)
    }

    private fun paymentResponseFrom(root: JsonObject): JsonObject? {
        val envelope = root.getAsJsonObject("SaleToPOIResponse") ?: root
        envelope.getAsJsonObject("PaymentResponse")?.let { return it }
        // Recovery path: the original response is nested inside the status response.
        envelope.getAsJsonObject("TransactionStatusResponse")
            ?.getAsJsonObject("RepeatedMessageResponse")
            ?.getAsJsonObject("RepeatedResponseMessageBody")
            ?.getAsJsonObject("PaymentResponse")
            ?.let { return it }
        return root.takeIf { it.has("POIData") || it.has("PaymentReceipt") }
    }
}
