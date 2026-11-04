package com.chaslay.pos.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.Path

data class UpdatePaymentMethodRequest(
    @SerializedName("paymentMethod") val paymentMethod: String,
)

interface PosOrdersApi {
    @PATCH("api/merchant/pos/orders/{id}/payment-method")
    suspend fun updatePaymentMethod(
        @Header("Authorization") auth: String,
        @Path("id") orderId: String,
        @Body body: UpdatePaymentMethodRequest,
    )
}
