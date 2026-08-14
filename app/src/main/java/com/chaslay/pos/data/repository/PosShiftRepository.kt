package com.chaslay.pos.data.repository

import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.data.remote.PosShiftApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PosShiftRepository @Inject constructor(
    private val posShiftApi: PosShiftApi,
    private val syncPreferences: SyncPreferences
) {
    private suspend fun bearer(): String {
        val token = syncPreferences.getDashboardToken()?.trim().orEmpty()
        require(token.isNotBlank()) { "Cloud login required for shift check" }
        return "Bearer $token"
    }

    /** True when merchant has an open POS cash shift. */
    suspend fun hasOpenShift(): Result<Boolean> = runCatching {
        val response = posShiftApi.current(bearer())
        response.shift?.status == "open"
    }
}
