package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.GiftCardCreditRequest
import com.chaslay.pos.data.remote.dto.GiftCardCreditResponse
import com.chaslay.pos.data.remote.dto.GiftCardLookupResponse
import com.chaslay.pos.data.remote.dto.GiftCardPointsRequest
import com.chaslay.pos.data.remote.dto.GiftCardPointsResponse
import com.chaslay.pos.data.remote.dto.GiftCardRedeemRequest
import com.chaslay.pos.data.remote.dto.GiftCardRedeemResponse
import com.chaslay.pos.data.remote.dto.GiftCardSettingsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface GiftCardApi {
    @GET("api/gift-cards/settings")
    suspend fun settings(@Header("Authorization") auth: String): GiftCardSettingsResponse

    @GET("api/gift-cards/lookup/{code}")
    suspend fun lookup(
        @Header("Authorization") auth: String,
        @Path("code") code: String,
        @Query("mediaType") mediaType: String? = null
    ): GiftCardLookupResponse

    @POST("api/gift-cards/{cardId}/points/earn")
    suspend fun earnPoints(
        @Header("Authorization") auth: String,
        @Path("cardId") cardId: String,
        @Body body: GiftCardPointsRequest
    ): GiftCardPointsResponse

    @POST("api/gift-cards/{cardId}/points/redeem")
    suspend fun redeemPoints(
        @Header("Authorization") auth: String,
        @Path("cardId") cardId: String,
        @Body body: GiftCardPointsRequest
    ): GiftCardPointsResponse

    @POST("api/gift-cards/credit")
    suspend fun credit(
        @Header("Authorization") auth: String,
        @Body body: GiftCardCreditRequest
    ): GiftCardCreditResponse

    @POST("api/gift-cards/redeem")
    suspend fun redeem(
        @Header("Authorization") auth: String,
        @Body body: GiftCardRedeemRequest
    ): GiftCardRedeemResponse

    @POST("api/gift-cards/send-ecard-email")
    suspend fun sendEcardEmail(
        @Header("Authorization") auth: String,
        @Body body: com.chaslay.pos.data.remote.dto.GiftCardSendEcardEmailRequest
    ): com.chaslay.pos.data.remote.dto.GiftCardSendEcardEmailResponse

    @POST("api/gift-cards/sell-membership")
    suspend fun sellMembership(
        @Header("Authorization") auth: String,
        @Body body: com.chaslay.pos.data.remote.dto.GiftCardSellMembershipRequest
    ): com.chaslay.pos.data.remote.dto.GiftCardSellMembershipResponse

    @POST("api/gift-cards/{cardId}/stamps/increment")
    suspend fun incrementStamp(
        @Header("Authorization") auth: String,
        @Path("cardId") cardId: String,
        @Body body: com.chaslay.pos.data.remote.dto.GiftCardStampRequest
    ): com.chaslay.pos.data.remote.dto.GiftCardStampResponse
}
