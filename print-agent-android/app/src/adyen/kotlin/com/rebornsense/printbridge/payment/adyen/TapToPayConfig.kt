package com.rebornsense.printbridge.payment.adyen

object TapToPayConfig {
    @Volatile var apiBaseUrl: String? = null
    @Volatile var authToken: String? = null

    fun clear() {
        apiBaseUrl = null
        authToken = null
    }
}
