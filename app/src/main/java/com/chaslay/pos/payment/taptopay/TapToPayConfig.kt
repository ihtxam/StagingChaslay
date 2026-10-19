package com.chaslay.pos.payment.taptopay

/**
 * Process-wide config the Tap to Pay flow populates before the Adyen SDK runs.
 *
 * The SDK's authentication provider is instantiated by the SDK itself (via the
 * manifest <service> declaration), so it cannot be Hilt-injected — it reads the
 * backend base URL and bearer token from here instead. The Adyen engine sets
 * these just before invoking the SDK; sign-out clears them.
 *
 * Lives in src/main rather than src/adyen because sign-out clears it regardless
 * of whether the build includes the SDK.
 */
object TapToPayConfig {
    @Volatile var apiBaseUrl: String? = null
    @Volatile var authToken: String? = null

    fun clear() {
        apiBaseUrl = null
        authToken = null
    }
}
