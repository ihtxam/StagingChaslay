package com.rebornsense.printbridge

import com.rebornsense.printbridge.service.PrintBridgeService
import java.net.HttpURLConnection
import java.net.URL

object BridgeHealthChecker {
    private const val CONNECT_TIMEOUT_MS = 1500
    private const val READ_TIMEOUT_MS = 1500

    fun isHealthy(): Boolean {
        return probeHealth() != null
    }

    fun probeHealth(): HealthSnapshot? {
        val url = URL("http://127.0.0.1:${PrintBridgeService.PORT}/health")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            requestMethod = "GET"
            useCaches = false
        }
        return try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            if (!body.contains("\"ok\":true") && !body.contains("\"ok\": true")) return null
            HealthSnapshot(
                version = jsonString(body, "version"),
                nfcAvailable = jsonBoolean(body, "nfcAvailable"),
                tapToPayReady = jsonBoolean(body, "tapToPayReady"),
                tapToPayMessage = jsonString(body, "tapToPayMessage"),
                hasAdyenSdk = jsonBoolean(body, "hasAdyenSdk"),
            )
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun jsonString(body: String, key: String): String? =
        Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(body)?.groupValues?.getOrNull(1)

    private fun jsonBoolean(body: String, key: String): Boolean? =
        when {
            body.contains("\"$key\":true") || body.contains("\"$key\": true") -> true
            body.contains("\"$key\":false") || body.contains("\"$key\": false") -> false
            else -> null
        }

    data class HealthSnapshot(
        val version: String? = null,
        val nfcAvailable: Boolean? = null,
        val tapToPayReady: Boolean? = null,
        val tapToPayMessage: String? = null,
        val hasAdyenSdk: Boolean? = null,
    )
}
