package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class GiftCardLookupResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    val error: String? = null
)

data class GiftCardDto(
    val id: String,
    @SerializedName("cardNumber") val cardNumber: String? = null,
    val balance: String? = null,
    val status: String? = null,
    @SerializedName("membershipEnabled") val membershipEnabled: Boolean = false,
    @SerializedName("pointsBalance") val pointsBalance: Int? = null,
    @SerializedName("customerId") val customerId: String? = null,
    @SerializedName("holderName") val holderName: String? = null,
    val customer: GiftCardCustomerDto? = null
) {
    val balanceAmount: Double get() = balance?.toDoubleOrNull() ?: 0.0
    val points: Int get() = pointsBalance ?: 0
    val displayName: String? get() =
        holderName?.takeIf { it.isNotBlank() }
            ?: customer?.let { listOfNotNull(it.firstName, it.lastName).joinToString(" ").trim().ifBlank { null } }
}

data class GiftCardCustomerDto(
    val id: String,
    @SerializedName("firstName") val firstName: String? = null,
    @SerializedName("lastName") val lastName: String? = null,
    val email: String? = null,
    val phone: String? = null
)

data class GiftCardSettingsResponse(
    val success: Boolean = false,
    val settings: GiftCardSettingsDto? = null
)

data class GiftCardSettingsDto(
    val enabled: Boolean = false,
    @SerializedName("presetDenominations") val presetDenominations: List<Double> = emptyList(),
    @SerializedName("minAmount") val minAmount: Double = 5.0,
    @SerializedName("maxAmount") val maxAmount: Double = 500.0,
    @SerializedName("reloadEnabled") val reloadEnabled: Boolean = true,
    @SerializedName("customAmountEnabled") val customAmountEnabled: Boolean = true
)

data class GiftCardPointsRequest(
    val points: Int,
    @SerializedName("orderId") val orderId: String? = null
)

data class GiftCardPointsResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    val message: String? = null,
    val error: String? = null
)

data class GiftCardCreditRequest(
    val type: String,
    @SerializedName("cardId") val cardId: String? = null,
    @SerializedName("cardNumber") val cardNumber: String? = null,
    @SerializedName("cardMediaType") val cardMediaType: String = "physical",
    val amount: Double,
    @SerializedName("orderId") val orderId: String? = null,
    @SerializedName("createIfMissing") val createIfMissing: Boolean = true
)

data class GiftCardCreditResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    val error: String? = null
)

data class GiftCardRedeemRequest(
    @SerializedName("cardId") val cardId: String? = null,
    @SerializedName("cardNumber") val cardNumber: String? = null,
    val amount: Double,
    @SerializedName("orderId") val orderId: String? = null,
    @SerializedName("allowPartial") val allowPartial: Boolean = true
)

data class GiftCardRedeemResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    @SerializedName("amountRedeemed") val amountRedeemed: String? = null,
    @SerializedName("remainingBalance") val remainingBalance: String? = null,
    val error: String? = null
)
