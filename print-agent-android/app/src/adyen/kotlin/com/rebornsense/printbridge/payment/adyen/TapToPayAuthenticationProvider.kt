package com.rebornsense.printbridge.payment.adyen

import com.adyen.ipp.api.authentication.AuthenticationProvider
import com.adyen.ipp.api.authentication.AuthenticationResponse
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class TapToPayAuthenticationProvider : AuthenticationProvider {
    private val httpClient = OkHttpClient()

    override suspend fun authenticate(setupToken: String): Result<AuthenticationResponse> {
        val baseUrl = TapToPayConfig.apiBaseUrl
            ?: return Result.failure(IllegalStateException("TapToPayConfig.apiBaseUrl not set"))
        val authToken = TapToPayConfig.authToken
            ?: return Result.failure(IllegalStateException("TapToPayConfig.authToken not set"))

        val body = JSONObject()
            .put("setup_token", setupToken)
            .put("platform", "android")
            .toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$baseUrl/api/tap-to-pay/sessions")
            .header("Authorization", "Bearer $authToken")
            .header("Accept", "application/json")
            .post(body)
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return Result.failure(IOException("Backend session call failed: ${response.code} $responseBody"))
                }
                val json = JSONObject(responseBody)
                val sdkData = json.optString("sdk_data")
                if (sdkData.isEmpty()) {
                    return Result.failure(IOException("Backend session response missing sdk_data"))
                }
                Result.success(AuthenticationResponse.create(sdkData))
            }
        } catch (e: Throwable) {
            Result.failure(e)
        }
    }
}
