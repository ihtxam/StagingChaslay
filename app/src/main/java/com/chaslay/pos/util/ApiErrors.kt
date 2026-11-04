package com.chaslay.pos.util

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import retrofit2.HttpException

fun parseApiErrorMessage(error: Throwable, fallback: String): String {
    if (error is HttpException) {
        val raw = error.response()?.errorBody()?.use { it.string() }
        if (!raw.isNullOrBlank()) {
            runCatching {
                val json = JsonParser.parseString(raw).asJsonObject
                json.get("message")?.asString?.takeIf { it.isNotBlank() }
                    ?: json.get("error")?.asString?.takeIf { it.isNotBlank() }
            }.getOrNull()?.let { return it }
        }
        return when (error.code()) {
            404 -> fallback
            else -> fallback
        }
    }
    val msg = error.message?.trim().orEmpty()
    if (msg.startsWith("HTTP ", ignoreCase = true)) return fallback
    return msg.ifBlank { fallback }
}
