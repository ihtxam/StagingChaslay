package com.chaslay.pos.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ActivateLicenseRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("activationCode") val activationCode: String,
    @SerializedName("appVersion") val appVersion: String,
    @SerializedName("deviceModel") val deviceModel: String? = null,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class ActivateLicenseResponse(
    @SerializedName("status") val status: String,
    @SerializedName("expiresAt") val expiresAt: Long,
    @SerializedName("customerName") val customerName: String? = null,
    @SerializedName("planLabel") val planLabel: String? = null,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class ValidateLicenseRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("appVersion") val appVersion: String,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class ValidateLicenseResponse(
    @SerializedName("status") val status: String,
    @SerializedName("expiresAt") val expiresAt: Long,
    @SerializedName("customerName") val customerName: String? = null,
    @SerializedName("planLabel") val planLabel: String? = null
)

data class LicenseActivationErrorRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("activationCode") val activationCode: String? = null,
    @SerializedName("errorMessage") val errorMessage: String,
    @SerializedName("appVersion") val appVersion: String? = null,
    @SerializedName("deviceModel") val deviceModel: String? = null,
    @SerializedName("tenantSlug") val tenantSlug: String? = null
)

data class LicenseActivationErrorResponse(
    @SerializedName("ok") val ok: Boolean,
    @SerializedName("referenceId") val referenceId: String? = null
)
