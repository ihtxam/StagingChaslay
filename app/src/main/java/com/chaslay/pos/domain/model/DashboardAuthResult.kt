package com.chaslay.pos.domain.model

sealed class DashboardAuthResult {
    data object Success : DashboardAuthResult()
    data class Failure(val message: String) : DashboardAuthResult()
}
