package com.chaslay.pos.data.remote

import com.google.gson.annotations.SerializedName
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Streaming

data class InvoiceRecordPaymentRequest(
    @SerializedName("paymentMethod") val paymentMethod: String
)

data class InvoiceRecordPaymentResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("order") val order: InvoiceOrderDto? = null
)

data class InvoiceOrderDto(
    @SerializedName("id") val id: String? = null,
    @SerializedName("invoiceNumber") val invoiceNumber: String? = null,
    @SerializedName("paymentMethod") val paymentMethod: String? = null,
    @SerializedName("paymentStatus") val paymentStatus: String? = null
)

interface InvoiceApi {
    @GET("v1/invoices/{id}/pdf")
    @Streaming
    suspend fun downloadPdf(@Path("id") id: String): ResponseBody

    @POST("v1/invoices/{id}/record-payment")
    suspend fun recordPayment(
        @Path("id") id: String,
        @Body body: InvoiceRecordPaymentRequest
    ): InvoiceRecordPaymentResponse
}
