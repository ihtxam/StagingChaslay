package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ReceiptPublishRequest(
    @SerializedName("id") val id: String,
    @SerializedName("transaction_number") val transactionNumber: String,
    @SerializedName("total") val total: Double,
    @SerializedName("currency") val currency: String,
    @SerializedName("payment_method") val paymentMethod: String,
    @SerializedName("card_reference") val cardReference: String? = null,
    @SerializedName("business_name") val businessName: String,
    @SerializedName("created_at") val createdAt: Long,
    @SerializedName("items") val items: List<ReceiptItemDto>,
    @SerializedName("subtotal") val subtotal: Double? = null,
    @SerializedName("tax_total") val taxTotal: Double? = null,
    @SerializedName("discount_amount") val discountAmount: Double? = null,
    @SerializedName("item_discount_total") val itemDiscountTotal: Double? = null,
    @SerializedName("tip_amount") val tipAmount: Double? = null,
    @SerializedName("payment_breakdown") val paymentBreakdown: List<ReceiptTenderDto>? = null,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("customer_phone") val customerPhone: String? = null,
    @SerializedName("customer_email") val customerEmail: String? = null,
    @SerializedName("shipping_address") val shippingAddress: String? = null,
    @SerializedName("fulfillment_channel") val fulfillmentChannel: String? = null,
    @SerializedName("pickup_time_ms") val pickupTimeMs: Long? = null,
    @SerializedName("master_order_id") val masterOrderId: String? = null,
    @SerializedName("split_check_number") val splitCheckNumber: Int? = null,
    @SerializedName("split_part_count") val splitPartCount: Int? = null,
    @SerializedName("rounding_amount") val roundingAmount: Double? = null,
    @SerializedName("staff_name") val staffName: String? = null,
    @SerializedName("payment_status") val paymentStatus: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("table_id") val tableId: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("adyen_customer_receipt_json") val adyenCustomerReceiptJson: String? = null,
    @SerializedName("adyen_cashier_receipt_json") val adyenCashierReceiptJson: String? = null
)

data class ReceiptTenderDto(
    @SerializedName("method") val method: String,
    @SerializedName("amount") val amount: Double
)

data class ReceiptItemDto(
    @SerializedName("product_name") val productName: String,
    @SerializedName("product_client_id") val productClientId: String? = null,
    @SerializedName("variant_name") val variantName: String? = null,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("line_total") val lineTotal: Double,
    @SerializedName("line_subtotal") val lineSubtotal: Double? = null,
    @SerializedName("line_discount") val lineDiscount: Double? = null,
    @SerializedName("unit_price") val unitPrice: Double? = null
)

data class ReceiptPublishResponse(
    @SerializedName("url") val url: String? = null,
    @SerializedName("id") val id: String? = null,
    @SerializedName("invoiceNumber") val invoiceNumber: String? = null,
    @SerializedName("invoicePdfPath") val invoicePdfPath: String? = null
)

data class ReceiptEmailRequest(
    @SerializedName("email") val email: String,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("order_number") val orderNumber: String? = null,
    @SerializedName("transaction_number") val transactionNumber: String? = null,
    @SerializedName("amount") val amount: Double? = null
)

data class ReceiptEmailResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("message") val message: String? = null
)

