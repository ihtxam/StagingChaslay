package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PosShiftCurrentResponse(
    val success: Boolean = false,
    val shift: PosShiftDto? = null,
    val live: PosShiftLiveDto? = null
)

data class PosShiftDto(
    val id: String? = null,
    val status: String? = null,
    @SerializedName("openedAt") val openedAt: String? = null
)

data class PosShiftLiveDto(
    @SerializedName("cashSales") val cashSales: Double = 0.0,
    @SerializedName("cashIn") val cashIn: Double = 0.0,
    @SerializedName("cashOut") val cashOut: Double = 0.0,
    @SerializedName("expectedCash") val expectedCash: Double = 0.0
)

data class CashMovementRequest(
    val type: String,
    val amount: Double,
    val reason: String? = null,
    @SerializedName("staffId") val staffId: String? = null,
    @SerializedName("staffName") val staffName: String? = null
)

data class CashMovementResponse(
    val success: Boolean = false,
    val live: PosShiftLiveDto? = null
)
