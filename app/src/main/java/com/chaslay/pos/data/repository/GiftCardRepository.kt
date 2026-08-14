package com.chaslay.pos.data.repository

import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.GiftCardApi
import com.chaslay.pos.data.remote.dto.GiftCardCreditRequest
import com.chaslay.pos.data.remote.dto.GiftCardDto
import com.chaslay.pos.data.remote.dto.GiftCardPointsRequest
import com.chaslay.pos.data.remote.dto.GiftCardRedeemRequest
import com.chaslay.pos.data.remote.dto.GiftCardSettingsDto
import com.chaslay.pos.domain.model.AttachedMembership
import com.chaslay.pos.domain.model.GiftCardOp
import com.chaslay.pos.data.remote.dto.GiftCardSendEcardEmailRequest
import com.chaslay.pos.domain.model.GiftCardCode
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GiftCardRepository @Inject constructor(
    private val giftCardApi: GiftCardApi,
    private val syncPreferences: SyncPreferences
) {
    private suspend fun bearer(): String {
        val token = syncPreferences.getDashboardToken()?.trim().orEmpty()
        require(token.isNotBlank()) { "Cloud login required for gift cards" }
        return "Bearer $token"
    }

    suspend fun fetchSettings(): Result<GiftCardSettingsDto> = runCatching {
        val response = giftCardApi.settings(bearer())
        response.settings ?: throw IllegalStateException("Gift card settings unavailable")
    }

    suspend fun lookupPhysical(code: String): Result<GiftCardDto> = lookupCode(code, "physical")

    suspend fun lookupCode(code: String, mediaType: String? = null): Result<GiftCardDto> = runCatching {
        val parsed = GiftCardCode.parse(code).ifBlank { code.trim() }
        val normalized = LoyaltyMath.normalizeRfidUid(parsed).ifBlank { parsed }
        val lookupKey = normalized.ifBlank { parsed }
        val response = giftCardApi.lookup(bearer(), lookupKey, mediaType)
        response.card ?: throw IllegalStateException(response.error ?: "Card not found")
    }

    suspend fun earnPoints(cardId: String, points: Int, orderId: String? = null): Result<Int> = runCatching {
        val response = giftCardApi.earnPoints(bearer(), cardId, GiftCardPointsRequest(points, orderId))
        response.card?.points ?: throw IllegalStateException(response.error ?: "Failed to earn points")
    }

    suspend fun redeemPoints(cardId: String, points: Int, orderId: String? = null): Result<Int> = runCatching {
        val response = giftCardApi.redeemPoints(bearer(), cardId, GiftCardPointsRequest(points, orderId))
        response.card?.points ?: throw IllegalStateException(response.error ?: "Failed to redeem points")
    }

    suspend fun creditCard(
        op: GiftCardOp,
        cardNumber: String,
        amount: Double,
        cardId: String? = null,
        orderId: String? = null,
        mediaType: String = "physical",
        ecardEmail: String? = null,
        holderName: String? = null
    ): Result<GiftCardDto> = runCatching {
        val parsed = GiftCardCode.parse(cardNumber).ifBlank { cardNumber.trim() }
        val normalized = if (mediaType == "e_card") parsed else LoyaltyMath.normalizeRfidUid(parsed).ifBlank { parsed }
        val response = giftCardApi.credit(
            bearer(),
            GiftCardCreditRequest(
                type = if (op == GiftCardOp.SELL) "sell" else "reload",
                cardId = cardId,
                cardNumber = normalized.ifBlank { null },
                cardMediaType = mediaType,
                amount = amount,
                orderId = orderId,
                createIfMissing = op == GiftCardOp.SELL,
                ecardEmail = ecardEmail,
                holderName = holderName
            )
        )
        response.card ?: throw IllegalStateException(response.error ?: "Failed to credit gift card")
    }

    suspend fun sendEcardEmail(
        to: String,
        code: String,
        balance: Double,
        holderName: String? = null,
        orderId: String? = null
    ): Result<Unit> = runCatching {
        val response = giftCardApi.sendEcardEmail(
            bearer(),
            GiftCardSendEcardEmailRequest(
                to = to.trim(),
                code = GiftCardCode.qrPayload(code),
                balance = balance,
                holderName = holderName,
                orderId = orderId
            )
        )
        if (response.success != true && response.sent != true) {
            throw IllegalStateException(response.error ?: response.message ?: "Failed to send email")
        }
    }

    data class RedeemResult(
        val card: GiftCardDto,
        val amountRedeemed: Double,
        val remainingBalance: Double
    )

    suspend fun redeemBalance(
        cardId: String,
        cardNumber: String,
        amount: Double,
        orderId: String? = null,
        allowPartial: Boolean = true
    ): Result<RedeemResult> = runCatching {
        val parsed = GiftCardCode.parse(cardNumber).ifBlank { cardNumber.trim() }
        val response = giftCardApi.redeem(
            bearer(),
            GiftCardRedeemRequest(
                cardId = cardId,
                cardNumber = parsed.takeIf { it.isNotBlank() },
                amount = amount,
                orderId = orderId,
                allowPartial = allowPartial
            )
        )
        val card = response.card ?: throw IllegalStateException(response.error ?: "Failed to redeem gift card")
        RedeemResult(
            card = card,
            amountRedeemed = response.amountRedeemed?.toDoubleOrNull() ?: amount,
            remainingBalance = response.remainingBalance?.toDoubleOrNull() ?: card.balanceAmount
        )
    }

    fun toAttachedMembership(card: GiftCardDto): AttachedMembership =
        AttachedMembership(
            cardId = card.id,
            cardNumber = card.cardNumber.orEmpty(),
            customerName = card.displayName,
            customerId = card.customerId ?: card.customer?.id,
            pointsBalance = card.points,
            giftBalance = card.balanceAmount,
            membershipEnabled = card.membershipEnabled
        )
}
