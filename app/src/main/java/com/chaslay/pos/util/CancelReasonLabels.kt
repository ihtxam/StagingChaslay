package com.chaslay.pos.util

import android.content.Context
import android.content.res.Configuration
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.AppLanguage
import java.util.Locale

/** Localized cancel-order reasons (stable ids 1–6). Strings live in values-* as UTF-8. */
object CancelReasonLabels {
    private val reasonResIds = listOf(
        R.string.cancel_reason_could_not_process,
        R.string.cancel_reason_kitchen_busy,
        R.string.cancel_reason_client,
        R.string.cancel_reason_out_of_stock,
        R.string.cancel_reason_wrong_order,
        R.string.cancel_reason_other,
    )

    fun localizedLabels(context: Context, languageCode: String): List<String> {
        val ctx = localizedContext(context, languageCode)
        return reasonResIds.map { ctx.getString(it) }
    }

    fun localizedLabel(context: Context, id: Long, languageCode: String): String {
        val index = (id - 1).toInt().coerceIn(0, reasonResIds.lastIndex)
        return localizedContext(context, languageCode).getString(reasonResIds[index])
    }

    private fun localizedContext(context: Context, languageCode: String): Context {
        val locale = Locale.forLanguageTag(AppLanguage.fromCode(languageCode).code)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}
