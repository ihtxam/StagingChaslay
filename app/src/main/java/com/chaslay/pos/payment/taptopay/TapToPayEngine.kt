package com.chaslay.pos.payment.taptopay

import android.app.Activity
import android.app.Application
import androidx.activity.ComponentActivity
import com.chaslay.pos.payment.PaymentResult

/**
 * Why a device cannot take a contactless payment, or [READY] when it can.
 *
 * Checked before a sale starts so the cashier learns about a problem in Settings
 * rather than in front of a customer with a card in their hand.
 */
enum class TapToPayReadiness {
    /** Built without the Adyen SDK — no POS Mobile API key at build time. */
    NO_SDK,

    /** Hardware has no NFC reader. */
    NO_NFC,

    /**
     * Android older than 12. The app's minSdk is 26, so such devices install and
     * run the POS normally, but the Adyen SDK does not initialize on them at all.
     * Without this state they fail at attestation with no usable explanation.
     */
    OS_TOO_OLD,

    /** No dashboard token; the SDK cannot obtain a SoftPOS session without one. */
    NOT_SIGNED_IN,

    /** Signed in, but Adyen device attestation has not been completed yet. */
    NOT_REGISTERED,

    READY,
}

/** Outcome of an attestation attempt. */
data class TapToPayRegisterResult(
    val ok: Boolean,
    val message: String,
    val installationId: String? = null,
)

/**
 * Tap to Pay behind an interface so the rest of the app never imports the Adyen
 * In-Person Payments SDK directly.
 *
 * The SDK is served from a credentialed Maven repo and is only on the classpath
 * when `adyenSdkApiKey` is present in local.properties. The implementation that
 * uses it therefore lives in the `src/adyen` source set; builds without the key
 * compile `src/noAdyen` instead, which reports Tap to Pay as unavailable.
 * `BuildConfig.HAS_ADYEN_SDK` says which one is in the build.
 */
interface TapToPayEngine {

    /** True when this build can run Tap to Pay and the device has an NFC reader. */
    fun isSupported(): Boolean

    /** Why this device cannot take a tap payment, or [TapToPayReadiness.READY]. */
    suspend fun readiness(): TapToPayReadiness

    /**
     * Performs Adyen device attestation and remembers the result.
     *
     * Run from Settings, never from a sale: first-run attestation contacts Adyen
     * and can take tens of seconds, and its failures are indistinguishable from a
     * declined card if they surface mid-checkout.
     */
    suspend fun registerDevice(): TapToPayRegisterResult

    /** Runs the SDK's startup initializer. Called once from the Application. */
    fun initialize(application: Application)

    /**
     * Registers the SDK's activity-result listener. Must be called before the
     * activity reaches RESUMED, because sale results are delivered through it.
     */
    fun registerForPaymentResult(activity: ComponentActivity)

    /** Pre-loads native libraries. Safe to call early; failures are ignored. */
    suspend fun warmUp()

    /**
     * Runs one contactless sale and suspends until the SDK reports the result.
     *
     * [reference] is the POS transaction id. It travels to Adyen as the
     * SaleTransactionID and comes back on the AUTHORISATION webhook as
     * merchantReference, where the backend matches it against orders.client_id.
     * Reusing it across retries of the same sale also engages the backend's
     * idempotency cache, so a retried request cannot become a second charge.
     */
    suspend fun processPayment(
        activity: Activity,
        amount: Double,
        currencyCode: String,
        reference: String?,
    ): PaymentResult
}
