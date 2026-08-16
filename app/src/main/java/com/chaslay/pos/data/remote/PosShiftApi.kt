package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.CashMovementRequest
import com.chaslay.pos.data.remote.dto.CashMovementResponse
import com.chaslay.pos.data.remote.dto.PosShiftCurrentResponse
import retrofit2.http.GET
import retrofit2.http.Header

interface PosShiftApi {
    @GET("api/merchant/pos/shifts/current")
    suspend fun current(@Header("Authorization") auth: String): PosShiftCurrentResponse

    @retrofit2.http.POST("api/merchant/pos/shifts/cash-movement")
    suspend fun recordCashMovement(
        @Header("Authorization") auth: String,
        @retrofit2.http.Body body: CashMovementRequest
    ): CashMovementResponse
}
