package com.chaslay.pos.customerdisplay

import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity

object CdsPublicUrl {
    fun resolve(settings: BusinessSettingsEntity): String {
        val synced = settings.cdsDisplayUrl.trim()
        if (synced.startsWith("http")) return synced
        return build(settings.cdsMerchantSlug, settings.cdsShortCode)
    }

    fun build(merchantSlug: String?, shortCode: String?): String {
        val origin = BuildConfig.MERCHANT_DASHBOARD_URL.trim().trimEnd('/')
        val slug = merchantSlug?.trim().orEmpty()
        if (slug.isNotEmpty()) {
            return "$origin/cds/m/${java.net.URLEncoder.encode(slug, Charsets.UTF_8.name())}"
        }
        val code = shortCode?.trim().orEmpty()
        if (code.isNotEmpty()) {
            return "$origin/cds/${java.net.URLEncoder.encode(code, Charsets.UTF_8.name())}"
        }
        return "$origin/cds/"
    }
}
