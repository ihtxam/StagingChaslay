package com.chaslay.pos.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.POST

data class PosSessionRegisterRequest(
    @SerializedName("sessionKind") val sessionKind: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceLabel") val deviceLabel: String? = null,
    @SerializedName("staffId") val staffId: String? = null,
    @SerializedName("staffName") val staffName: String? = null,
)

data class PosSessionRegisterResponse(
    @SerializedName("sessionId") val sessionId: String?,
    @SerializedName("heartbeatIntervalSec") val heartbeatIntervalSec: Int? = null,
)

data class PosSessionHeartbeatRequest(
    @SerializedName("sessionId") val sessionId: String,
)

data class PosSessionRevokeRequest(
    @SerializedName("sessionId") val sessionId: String? = null,
    @SerializedName("deviceId") val deviceId: String? = null,
    @SerializedName("sessionKind") val sessionKind: String? = null,
)

interface PosSessionApi {
    @POST("v1/pos/sessions/register")
    suspend fun register(@Body body: PosSessionRegisterRequest): PosSessionRegisterResponse

    @POST("v1/pos/sessions/heartbeat")
    suspend fun heartbeat(@Body body: PosSessionHeartbeatRequest): Map<String, Any?>

    @POST("v1/pos/sessions/revoke")
    suspend fun revoke(@Body body: PosSessionRevokeRequest): Map<String, Any?>
}
