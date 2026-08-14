package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PosShiftCurrentResponse(
    val success: Boolean = false,
    val shift: PosShiftDto? = null
)

data class PosShiftDto(
    val id: String? = null,
    val status: String? = null,
    @SerializedName("openedAt") val openedAt: String? = null
)
