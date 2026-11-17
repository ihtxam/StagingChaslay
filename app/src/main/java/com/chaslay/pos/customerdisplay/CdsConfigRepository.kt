package com.chaslay.pos.customerdisplay

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

@Singleton
class CdsConfigRepository @Inject constructor(
    private val httpClient: OkHttpClient,
) {
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
                    parseBrandingJson(body, settings)
                }
            }.getOrDefault(fallback)
        }

    private fun parseBrandingJson(body: String, settings: BusinessSettingsEntity): CustomerDisplayBranding {
        val root = JSONObject(body)
        val merchant = root.optJSONObject("merchant")
        val merchantName = merchant?.optString("name")?.trim().orEmpty()
            .ifBlank { settings.businessName }
        val logo = merchant?.optString("logoUrl")?.trim()?.takeIf { it.isNotEmpty() }
            ?: settings.logoUri?.takeIf { it.startsWith("http") }
        val promo = root.optJSONObject("settings")
            ?.optJSONArray("promoSlides")
            ?.optJSONObject(0)
            ?.optString("imageUrl")
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
        return CustomerDisplayBranding(
            merchantName = merchantName,
            logoUrl = logo,
            promoImageUrl = promo,
        )
    }
}
