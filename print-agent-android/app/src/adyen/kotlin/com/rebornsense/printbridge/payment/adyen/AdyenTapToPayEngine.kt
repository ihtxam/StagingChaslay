package com.rebornsense.printbridge.payment.adyen

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.appcompat.app.AppCompatActivity
import com.adyen.ipp.api.InPersonPayments
import com.adyen.ipp.api.payment.PaymentInterfaceType
import com.adyen.ipp.api.payment.TransactionRequest
import com.rebornsense.printbridge.payment.TapToPayAuthParams
import com.rebornsense.printbridge.payment.TapToPayEngine
import com.rebornsense.printbridge.payment.TapToPayRegisterOutcome
import com.rebornsense.printbridge.payment.TapToPaySaleOutcome
import com.rebornsense.printbridge.payment.TapToPaySaleParams
import com.rebornsense.printbridge.setup.OemSetupPreferences
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

    override fun readinessMessage(context: Context): String = when {
        !adyenSdkAvailable() ->
            "This APK was built without the Adyen SDK. Install the Tap to Pay build from the merchant panel."
        !nfcAvailable(context) ->
            "This device has no NFC reader."
        !OemSetupPreferences.isTapToPayDeviceRegistered(context) ->
            "Tap to Pay not activated on this device. In WebPOS go to Settings → Payments → Activate Tap to Pay."
        else -> "Ready — take a card payment in WebPOS to start Tap to Pay."
    }

    private fun adyenSdkAvailable(): Boolean = runCatching {
        Class.forName("com.adyen.ipp.api.InPersonPayments")
        true
    }.getOrDefault(false)

    override suspend fun registerDevice(context: Context, params: TapToPayAuthParams): TapToPayRegisterOutcome {
        if (!adyenSdkAvailable()) {
            return TapToPayRegisterOutcome(ok = false, message = readinessMessage(context))
        }
        if (!nfcAvailable(context)) {
            return TapToPayRegisterOutcome(ok = false, message = readinessMessage(context))
        }
        if (params.authToken.isBlank() || params.apiBaseUrl.isBlank()) {
            return TapToPayRegisterOutcome(ok = false, message = "Missing auth token or API URL.")
        }

        TapToPayConfig.apiBaseUrl = params.apiBaseUrl.trimEnd('/')
        TapToPayConfig.authToken = params.authToken

        return try {
            withContext(Dispatchers.IO) { InPersonPayments.warmUp() }.getOrElse {
                return TapToPayRegisterOutcome(ok = false, message = "Warm-up failed: ${it.message}")
            }
            val installationId = withContext(Dispatchers.IO) { InPersonPayments.getInstallationId() }
                .getOrElse {
                    return TapToPayRegisterOutcome(ok = false, message = "Registration failed: ${it.message}")
                }
            OemSetupPreferences.setTapToPayDeviceRegistered(context, true)
            OemSetupPreferences.setStepCompleted(context, "tap_to_pay", true)
            TapToPayRegisterOutcome(ok = true, installationId = installationId, message = "Tap to Pay activated.")
        } catch (t: Throwable) {
            TapToPayRegisterOutcome(ok = false, message = t.message ?: "Tap to Pay setup failed.")
        } finally {
            TapToPayConfig.clear()
        }
    }

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
                message = readinessMessage(activity),
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
