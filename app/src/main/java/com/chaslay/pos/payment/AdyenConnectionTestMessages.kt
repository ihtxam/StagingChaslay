package com.chaslay.pos.payment

import android.content.Context
import com.chaslay.pos.R

fun AdyenConnectionTestResult.toDisplayMessage(context: Context): String {
    val terminal = terminalId.orEmpty()
    return when (code) {
        AdyenTestMessageCode.CONFIG_ERROR ->
            detail?.takeIf { it.isNotBlank() }
                ?: context.getString(R.string.adyen_test_config_incomplete)
        AdyenTestMessageCode.TERMINAL_ONLINE ->
            context.getString(R.string.adyen_test_success_online, terminal)
        AdyenTestMessageCode.TERMINAL_OFFLINE ->
            context.getString(R.string.adyen_test_terminal_offline, terminal)
        AdyenTestMessageCode.CONNECTION_OK ->
            if (terminal.isNotBlank()) {
                context.getString(R.string.adyen_test_connection_ok_terminal, terminal)
            } else {
                context.getString(R.string.adyen_test_connection_ok)
            }
        AdyenTestMessageCode.LEGACY_OK_CLOUD_403 ->
            context.getString(R.string.adyen_test_legacy_ok_cloud_403, terminal)
        AdyenTestMessageCode.NETWORK_ERROR ->
            context.getString(
                R.string.adyen_test_network_error,
                detail?.takeIf { it.isNotBlank() } ?: context.getString(R.string.adyen_test_network_unknown),
            )
        AdyenTestMessageCode.API_ERROR ->
            detail?.takeIf { it.isNotBlank() }
                ?: context.getString(R.string.adyen_test_failed_generic)
    }
}
