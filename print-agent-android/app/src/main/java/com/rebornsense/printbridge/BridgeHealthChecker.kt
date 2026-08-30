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
            val version = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.getOrNull(1)
            HealthSnapshot(version = version)
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    data class HealthSnapshot(val version: String? = null)
}
