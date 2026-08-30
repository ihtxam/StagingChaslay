package com.rebornsense.printbridge.payment.adyen

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.appcompat.app.AppCompatActivity
import com.adyen.ipp.api.InPersonPayments
import com.adyen.ipp.api.payment.PaymentInterfaceType
import com.adyen.ipp.api.payment.TransactionRequest
import com.rebornsense.printbridge.payment.TapToPayEngine
import com.rebornsense.printbridge.payment.TapToPaySaleOutcome
import com.rebornsense.printbridge.payment.TapToPaySaleParams
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class AdyenTapToPayEngine : TapToPayEngine {
    private val http = OkHttpClient()

    override fun isReady(): Boolean = adyenSdkAvailable()

    override fun readinessMessage(): String = when {
        !adyenSdkAvailable() ->
            "This APK was built without the Adyen SDK. Install the Tap to Pay build from the merchant panel."
        else -> "Ready — Tap to Pay starts when you take a card payment in WebPOS."
    }

    private fun adyenSdkAvailable(): Boolean = runCatching {
        Class.forName("com.adyen.ipp.api.InPersonPayments")
        true
    }.getOrDefault(false)

    override suspend fun processSale(activity: Activity, params: TapToPaySaleParams): TapToPaySaleOutcome {
        if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)) {
            return TapToPaySaleOutcome(
                ok = false,
                status = "error",
                message = "This device does not support Tap to Pay (no NFC).",
            )
        }
        if (TapToPayCallbackRouter.launcher == null && activity is AppCompatActivity) {
            runCatching {
                Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenBootstrap")
                    .getMethod("register", AppCompatActivity::class.java)
                    .invoke(null, activity)
            }
        }
        val launcher = TapToPayCallbackRouter.launcher
            ?: return TapToPaySaleOutcome(
                ok = false,
                status = "error",
                message = readinessMessage(),
            )
        if (params.amountMinor <= 0L) {
            return TapToPaySaleOutcome(ok = false, status = "error", message = "Invalid amount.")
        }
        if (params.authToken.isBlank()) {
            return TapToPaySaleOutcome(ok = false, status = "error", message = "Missing auth token.")
        }

        TapToPayConfig.apiBaseUrl = params.apiBaseUrl.trimEnd('/')
        TapToPayConfig.authToken = params.authToken

        return try {
            val installationId = withContext(Dispatchers.IO) { InPersonPayments.getInstallationId() }
                .getOrElse {
                    return TapToPaySaleOutcome(ok = false, status = "error", message = "Setup failed: ${it.message}")
                }

            val envelopeJson = withContext(Dispatchers.IO) {
                fetchSaleEnvelope(
                    params.apiBaseUrl.trimEnd('/'),
                    params.authToken,
                    params.amountMinor,
                    params.currency,
                    installationId,
                    params.reference,
                )
            }

            val transactionRequest = TransactionRequest.create(envelopeJson)
                .getOrElse {
                    return TapToPaySaleOutcome(ok = false, status = "error", message = "Invalid request: ${it.message}")
                }

            val paymentInterface = withContext(Dispatchers.IO) {
                InPersonPayments.getPaymentInterface(PaymentInterfaceType.createTapToPayType())
            }.getOrElse {
                return TapToPaySaleOutcome(ok = false, status = "error", message = "Unavailable: ${it.message}")
            }

            val deferred = CompletableDeferred<TapToPayCallbackResult>()
            TapToPayCallbackRouter.arm(deferred)

            InPersonPayments.performTransaction(
                context = activity,
                paymentLauncher = launcher,
                paymentInterface = paymentInterface,
                transactionRequest = transactionRequest,
            )

            val callback = deferred.await()
            if (callback.ok) {
                TapToPaySaleOutcome(ok = true, status = "approved", reference = callback.reference)
            } else {
                TapToPaySaleOutcome(ok = false, status = "declined", message = callback.message)
            }
        } catch (t: Throwable) {
            TapToPaySaleOutcome(ok = false, status = "error", message = t.message ?: "Tap to Pay failed.")
        } finally {
            TapToPayConfig.clear()
        }
    }

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
}

fun nfcAvailable(context: Context): Boolean =
    context.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)
