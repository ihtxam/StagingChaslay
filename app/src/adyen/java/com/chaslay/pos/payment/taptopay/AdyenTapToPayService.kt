package com.chaslay.pos.payment.taptopay

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.startup.AppInitializer
import com.adyen.ipp.api.InPersonPayments
import com.adyen.ipp.api.InPersonPaymentsInitializer
import com.adyen.ipp.api.payment.PaymentCallback
import com.adyen.ipp.api.payment.PaymentInterfaceType
import com.adyen.ipp.api.payment.TransactionRequest
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.payment.PaymentResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong

/**
 * Adyen Tap to Pay on Android (SoftPOS). Turns the phone's NFC reader into a
 * contactless card terminal via Adyen's In-Person Payments SDK.
 *
 * Flow per sale (see [processPayment]):
 *   1. Resolve the merchant's dashboard JWT + API base, populate [TapToPayConfig].
 *   2. Ask the SDK for its installationId — first time this triggers device
 *      attestation and [TapToPayAuthenticationProvider] → /api/tap-to-pay/sessions.
 *   3. POST /api/tap-to-pay/sale to build the Adyen Terminal API envelope.
 *   4. performTransaction() — the SDK presents the tap UI; the result arrives
 *      via the PaymentCallback registered in MainActivity → [TapToPayCallbackRouter].
 *
 * Requires a Play-Integrity-compliant device and Adyen SoftPOS enablement; it
 * cannot run on an emulator or on hardware that fails attestation.
 */
@Singleton
class AdyenTapToPayService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val syncPreferences: SyncPreferences,
) : TapToPayEngine {
    private val http = OkHttpClient()

    /** True when the device exposes NFC. Attestation is still checked at runtime by the SDK. */
    override fun isSupported(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)

    override suspend fun readiness(): TapToPayReadiness = when {
        // Checked first: the SDK will not initialize at all below Android 12, so
        // every later check would be answering the wrong question.
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S -> TapToPayReadiness.OS_TOO_OLD
        !isSupported() -> TapToPayReadiness.NO_NFC
        syncPreferences.getDashboardToken().isNullOrBlank() -> TapToPayReadiness.NOT_SIGNED_IN
        !syncPreferences.isTapToPayRegistered() -> TapToPayReadiness.NOT_REGISTERED
        else -> TapToPayReadiness.READY
    }

    /**
     * Warms the SDK and performs device attestation, then remembers the outcome.
     * Credentials are cleared afterwards so they do not outlive the call.
     */
    override suspend fun registerDevice(): TapToPayRegisterResult {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return TapToPayRegisterResult(
                ok = false,
                message = "Tap to Pay needs Android 12 or later on this device.",
            )
        }
        if (!isSupported()) {
            return TapToPayRegisterResult(ok = false, message = "This device has no NFC reader.")
        }
        val authToken = syncPreferences.getDashboardToken()
            ?: return TapToPayRegisterResult(
                ok = false,
                message = "Sign in with your online account to activate Tap to Pay.",
            )

        TapToPayConfig.apiBaseUrl = BuildConfig.LICENSE_API_BASE_URL.trimEnd('/')
        TapToPayConfig.authToken = authToken
        return try {
            withContext(Dispatchers.IO) { InPersonPayments.warmUp() }.getOrElse {
                return TapToPayRegisterResult(ok = false, message = "Warm-up failed: ${it.message}")
            }
            val installationId = withContext(Dispatchers.IO) { InPersonPayments.getInstallationId() }
                .getOrElse {
                    return TapToPayRegisterResult(
                        ok = false,
                        message = "Activation failed: ${it.message}",
                    )
                }
            syncPreferences.setTapToPayRegistered(true)
            TapToPayRegisterResult(
                ok = true,
                message = "Tap to Pay activated on this device.",
                installationId = installationId,
            )
        } catch (t: Throwable) {
            TapToPayRegisterResult(ok = false, message = t.message ?: "Activation failed.")
        } finally {
            TapToPayConfig.clear()
        }
    }

    /**
     * Force the SDK's androidx.startup initializer to run now so its
     * applicationContext is ready before any Activity invokes the SDK. Done
     * programmatically rather than via a manifest <meta-data> entry, so that
     * builds without the SDK have nothing to resolve at startup.
     */
    override fun initialize(application: Application) {
        try {
            AppInitializer.getInstance(application)
                .initializeComponent(InPersonPaymentsInitializer::class.java)
        } catch (t: Throwable) {
            Log.e(TAG, "Tap to Pay init failed", t)
        }
    }

    /**
     * Register the result listener before the activity reaches RESUMED. The
     * returned launcher is handed to performTransaction for each sale. Failures
     * are logged, not thrown: Tap to Pay stays off rather than crashing launch.
     */
    override fun registerForPaymentResult(activity: ComponentActivity) {
        try {
            TapToPayCallbackRouter.launcher = InPersonPayments.registerForPaymentResult(
                activity,
                PaymentCallback { result ->
                    @Suppress("UNCHECKED_CAST")
                    (result as Result<com.adyen.ipp.api.payment.PaymentResult>).fold(
                        onSuccess = { paymentResult -> TapToPayCallbackRouter.onSuccess(paymentResult) },
                        onFailure = { error -> TapToPayCallbackRouter.onFailure(error) },
                    )
                },
            )
        } catch (t: Throwable) {
            Log.e(TAG, "Tap to Pay launcher registration failed", t)
        }
    }

    /**
     * Warm up the SDK (pre-loads native libs). Safe to call early; ignores failures.
     */
    override suspend fun warmUp() {
        runCatching { withContext(Dispatchers.IO) { InPersonPayments.warmUp() } }
    }

    override suspend fun processPayment(
        activity: Activity,
        amount: Double,
        currencyCode: String,
        reference: String?,
    ): PaymentResult {
        // Refuse before touching the SDK. Attestation belongs in Settings; running it
        // here would stall the customer and surface as a failed payment.
        when (readiness()) {
            TapToPayReadiness.OS_TOO_OLD ->
                return PaymentResult.Failure("Tap to Pay needs Android 12 or later on this device.")
            TapToPayReadiness.NO_NFC ->
                return PaymentResult.Failure("This device does not support Tap to Pay (no NFC).")
            TapToPayReadiness.NOT_SIGNED_IN ->
                return PaymentResult.Failure("Sign in with your online account to use Tap to Pay.")
            TapToPayReadiness.NOT_REGISTERED ->
                return PaymentResult.Failure(
                    "Activate Tap to Pay on this device first (Settings → Payments)."
                )
            TapToPayReadiness.NO_SDK ->
                return PaymentResult.Failure("This build does not include Tap to Pay.")
            TapToPayReadiness.READY -> Unit
        }
        val authToken = syncPreferences.getDashboardToken()
            ?: return PaymentResult.Failure("Sign in with your online account to use Tap to Pay.")
        val baseUrl = BuildConfig.LICENSE_API_BASE_URL.trimEnd('/')
        val launcher = TapToPayCallbackRouter.launcher
            ?: return PaymentResult.Failure("Tap to Pay is not ready yet. Please try again.")

        // Adyen expects the amount in minor units. CHF/EUR/USD/GBP/AED/CAD are all
        // 2-decimal currencies (the app's supported set), so ×100 is correct here.
        val amountMinor = (amount * 100.0).roundToLong()
        if (amountMinor <= 0L) return PaymentResult.Failure("Invalid amount for Tap to Pay.")

        // Populate the process-wide config the SDK's AuthenticationProvider reads.
        TapToPayConfig.apiBaseUrl = baseUrl
        TapToPayConfig.authToken = authToken

        return try {
            val installationId = withContext(Dispatchers.IO) { InPersonPayments.getInstallationId() }
                .getOrElse { return PaymentResult.Failure("Tap to Pay setup failed: ${it.message}") }

            val envelopeJson = withContext(Dispatchers.IO) {
                fetchSaleEnvelope(baseUrl, authToken, amountMinor, currencyCode, installationId, reference)
            }

            val transactionRequest = TransactionRequest.create(envelopeJson)
                .getOrElse { return PaymentResult.Failure("Tap to Pay request was invalid: ${it.message}") }

            val paymentInterface = withContext(Dispatchers.IO) {
                InPersonPayments.getPaymentInterface(PaymentInterfaceType.createTapToPayType())
            }.getOrElse { return PaymentResult.Failure("Tap to Pay is unavailable on this device: ${it.message}") }

            val deferred = CompletableDeferred<PaymentResult>()
            TapToPayCallbackRouter.arm(deferred)

            InPersonPayments.performTransaction(
                context = activity,
                paymentLauncher = launcher,
                paymentInterface = paymentInterface,
                transactionRequest = transactionRequest,
            )

            deferred.await()
        } catch (e: Throwable) {
            PaymentResult.Failure(e.message ?: "Tap to Pay failed.")
        } finally {
            TapToPayConfig.clear()
        }
    }

    /**
     * POST /api/tap-to-pay/sale → returns the Adyen Terminal API envelope JSON string.
     */
    private fun fetchSaleEnvelope(
        baseUrl: String,
        authToken: String,
        amountMinor: Long,
        currency: String,
        installationId: String,
        reference: String?,
    ): String {
        val payload = JSONObject()
            .put("amount_minor", amountMinor)
            .put("currency", currency)
            .put("platform", "android")
            .put("installation_id", installationId)
        // Without a reference the backend mints a random TX-<uuid> the webhook can
        // never match to an order, and its idempotency cache stays disabled.
        if (!reference.isNullOrBlank()) payload.put("reference", reference)

        val body = payload.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$baseUrl/api/tap-to-pay/sale")
            .header("Authorization", "Bearer $authToken")
            .header("Accept", "application/json")
            .post(body)
            .build()

        http.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Backend /sale call failed: ${response.code} $responseBody")
            }
            val json = JSONObject(responseBody)
            val envelope = json.optJSONObject("terminal_api_request")
                ?: throw IOException("Backend /sale response missing terminal_api_request")
            return envelope.toString()
        }
    }

    private companion object {
        const val TAG = "AdyenTapToPay"
    }
}
