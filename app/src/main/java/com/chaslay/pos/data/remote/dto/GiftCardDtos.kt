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
    @SerializedName("cardMediaType") val cardMediaType: String? = null,
    @SerializedName("ecardCode") val ecardCode: String? = null,
    val balance: String? = null,
    val status: String? = null,
    @SerializedName("membershipEnabled") val membershipEnabled: Boolean = false,
    @SerializedName("cardKind") val cardKind: String? = null,
    @SerializedName("membershipPlanId") val membershipPlanId: String? = null,
    @SerializedName("membershipPlan") val membershipPlan: GiftCardMembershipPlanDto? = null,
    @SerializedName("stampCount") val stampCount: Int? = null,
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

data class GiftCardMembershipPlanDto(
    val id: String,
    val label: String,
    val type: String,
    @SerializedName("discountPercent") val discountPercent: Double? = null,
    @SerializedName("stampsRequired") val stampsRequired: Int? = null,
    @SerializedName("rewardProductId") val rewardProductId: String? = null,
    val active: Boolean = true
)

data class GiftCardSellMembershipRequest(
    @SerializedName("cardNumber") val cardNumber: String,
    @SerializedName("planId") val planId: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null
)

data class GiftCardSellMembershipResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    val error: String? = null
)

data class GiftCardStampRequest(
    @SerializedName("orderId") val orderId: String? = null,
    val increment: Int = 1
)

data class GiftCardStampResponse(
    val success: Boolean = false,
    val card: GiftCardDto? = null,
    @SerializedName("rewardEarned") val rewardEarned: Boolean = false,
    @SerializedName("stampCount") val stampCount: Int? = null,
    val error: String? = null
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
    @SerializedName("customAmountEnabled") val customAmountEnabled: Boolean = true,
    @SerializedName("membershipEnabled") val membershipEnabled: Boolean = false,
    @SerializedName("membershipPlans") val membershipPlans: List<GiftCardMembershipPlanDto> = emptyList()
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
    @SerializedName("createIfMissing") val createIfMissing: Boolean = true,
    @SerializedName("ecardEmail") val ecardEmail: String? = null,
    @SerializedName("holderName") val holderName: String? = null
)

data class GiftCardSendEcardEmailRequest(
    val to: String,
    val code: String,
    val balance: Double,
    @SerializedName("holderName") val holderName: String? = null,
    @SerializedName("orderId") val orderId: String? = null
)

data class GiftCardSendEcardEmailResponse(
    val success: Boolean = false,
    val sent: Boolean = false,
    val message: String? = null,
    val error: String? = null
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
