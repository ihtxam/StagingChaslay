package com.chaslay.pos.payment

import android.content.Context
import android.net.Uri
import com.chaslay.pos.R

data class AdyenTerminalPaymentFailure(
    val errorCondition: String?,
    val additionalResponse: String?,
)

fun isAdyenAuthenticationFailure(raw: String): Boolean {
    val lower = raw.lowercase()
    return lower.contains("00_401") ||
        lower.contains("http 401") ||
        lower.contains("authentication failed") ||
        lower.contains("invalid adyen api key") ||
        (lower.contains("401") && lower.contains("adyen"))
}

fun parseAdyenAdditionalResponseMessage(additionalResponse: String?): String? {
    if (additionalResponse.isNullOrBlank()) return null
    additionalResponse.split("&").forEach { part ->
        val eq = part.indexOf('=')
        if (eq <= 0) return@forEach
        val key = part.substring(0, eq).trim()
        if (key.equals("message", ignoreCase = true)) {
            val raw = part.substring(eq + 1)
            return Uri.decode(raw).takeIf { it.isNotBlank() }
        }
    }
    return null
}

fun AdyenTerminalPaymentFailure.toUserMessage(context: Context): String {
    val condition = errorCondition?.trim().orEmpty()
    val decodedMsg = parseAdyenAdditionalResponseMessage(additionalResponse)?.lowercase().orEmpty()

    if (isAdyenAuthenticationFailure(condition) || isAdyenAuthenticationFailure(decodedMsg)) {
        return context.getString(R.string.terminal_error_auth)
    }

    when {
        condition.equals("Busy", ignoreCase = true) ||
            decodedMsg.contains("temporary") && decodedMsg.contains("not available") ||
            decodedMsg.contains("another request") ->
            return context.getString(R.string.terminal_error_busy)

        condition.equals("UnavailableDevice", ignoreCase = true) ||
            condition.equals("UnreachableHost", ignoreCase = true) ||
            condition.equals("NotFound", ignoreCase = true) ||
            decodedMsg.contains("offline") ->
            return context.getString(R.string.terminal_error_offline)

        condition.equals("Refusal", ignoreCase = true) ||
            condition.equals("NotAllowed", ignoreCase = true) ||
            condition.equals("Declined", ignoreCase = true) ->
            return context.getString(R.string.terminal_error_refused)

        condition.equals("Aborted", ignoreCase = true) ->
            return context.getString(R.string.terminal_error_aborted)

        condition.equals("InvalidCard", ignoreCase = true) ||
            condition.equals("WrongPIN", ignoreCase = true) ->
            return context.getString(R.string.terminal_error_invalid_card)

        condition.equals("PaymentLimitExceeded", ignoreCase = true) ||
            condition.equals("LimitExceeded", ignoreCase = true) ->
            return context.getString(R.string.terminal_error_limit)

        condition.equals("Cancel", ignoreCase = true) ->
            return context.getString(R.string.terminal_pay_cancelled_msg)
    }
    return context.getString(R.string.terminal_error_generic)
}

fun formatTerminalTransportErrorMessage(context: Context, raw: String): String {
    val lower = raw.lowercase()
    return when {
        isAdyenAuthenticationFailure(raw) ->
            context.getString(R.string.terminal_error_auth)
        lower.contains("network") || lower.contains("could not reach") ->
            context.getString(R.string.terminal_error_network)
        else -> context.getString(R.string.terminal_error_generic)
    }
}

fun AdyenTerminalResponse.toUserPaymentMessage(context: Context): String? =
    when (this) {
        is AdyenTerminalResponse.Declined ->
            AdyenTerminalPaymentFailure(errorCondition, additionalResponse).toUserMessage(context)
        is AdyenTerminalResponse.Error -> formatTerminalTransportErrorMessage(context, message)
        else -> null
    }
