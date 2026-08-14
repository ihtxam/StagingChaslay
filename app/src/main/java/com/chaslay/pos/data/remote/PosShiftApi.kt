package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.PosShiftCurrentResponse
import retrofit2.http.GET
import retrofit2.http.Header

interface PosShiftApi {
    @GET("api/merchant/pos/shifts/current")
    suspend fun current(@Header("Authorization") auth: String): PosShiftCurrentResponse
}
