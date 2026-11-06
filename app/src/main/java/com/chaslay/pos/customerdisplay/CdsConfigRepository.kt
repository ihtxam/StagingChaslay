package com.chaslay.pos.customerdisplay

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

@Singleton
class CdsConfigRepository @Inject constructor(
    private val httpClient: OkHttpClient,
) {
    private val gson = Gson()
    suspend fun loadBranding(settings: BusinessSettingsEntity): CustomerDisplayBranding =
        withContext(Dispatchers.IO) {
            val fallback = CustomerDisplayBranding(
                merchantName = settings.businessName,
                logoUrl = settings.logoUri?.takeIf { it.startsWith("http") },
            )
            val token = settings.cdsAccessToken.trim()
            val slug = settings.cdsMerchantSlug.trim()
            val path = when {
                slug.isNotEmpty() -> "/api/cds/m/${java.net.URLEncoder.encode(slug, Charsets.UTF_8.name())}/config"
                token.isNotEmpty() -> "/api/cds/${java.net.URLEncoder.encode(token, Charsets.UTF_8.name())}/config"
                else -> return@withContext fallback
            }
            val base = BuildConfig.LICENSE_API_BASE_URL.trim().trimEnd('/')
            val request = Request.Builder().url("$base$path").get().build()
            runCatching {
                httpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) return@withContext fallback
                    val body = response.body?.string().orEmpty()
                    val parsed = gson.fromJson(body, CdsConfigResponse::class.java)
                    val merchantName = parsed.merchant?.name?.trim().orEmpty()
                        .ifBlank { settings.businessName }
                    val logo = parsed.merchant?.logoUrl?.trim()?.takeIf { it.isNotEmpty() }
                        ?: settings.logoUri?.takeIf { it.startsWith("http") }
                    val promo = parsed.settings?.promoSlides
                        ?.firstOrNull()
                        ?.imageUrl
                        ?.trim()
                        ?.takeIf { it.isNotEmpty() }
                    CustomerDisplayBranding(
                        merchantName = merchantName,
                        logoUrl = logo,
                        promoImageUrl = promo,
                    )
                }
            }.getOrDefault(fallback)
        }

    private data class CdsConfigResponse(
        val merchant: CdsMerchantDto? = null,
        val settings: CdsSettingsDto? = null,
    )

    private data class CdsMerchantDto(
        val name: String? = null,
        @SerializedName("logoUrl") val logoUrl: String? = null,
    )

    private data class CdsSettingsDto(
        @SerializedName("promoSlides") val promoSlides: List<CdsPromoSlideDto>? = null,
    )

    private data class CdsPromoSlideDto(
        @SerializedName("imageUrl") val imageUrl: String? = null,
    )
}
