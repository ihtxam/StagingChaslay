package com.rebornsense.printbridge

import com.rebornsense.printbridge.service.PrintBridgeService
import java.io.ByteArrayOutputStream
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException

object BridgeHealthChecker {
    private const val CONNECT_TIMEOUT_MS = 1500
    private const val READ_TIMEOUT_MS = 1500
    private const val MAX_RESPONSE_BYTES = 16 * 1024

    fun isHealthy(): Boolean = probeResult().snapshot != null

    /** Snapshot only. Use [probeResult] when the failure reason must be shown. */
    fun probeHealth(): HealthSnapshot? = probeResult().snapshot

    /**
     * GET http://127.0.0.1:9101/health on a raw socket.
     * A failed probe returns the exception message, HTTP status, or a body snippet.
     * It does not stop the service.
     */
    fun probeResult(): ProbeOutcome {
        val port = PrintBridgeService.PORT
        val socket = Socket()
        return try {
            socket.connect(InetSocketAddress("127.0.0.1", port), CONNECT_TIMEOUT_MS)
            socket.soTimeout = READ_TIMEOUT_MS
            socket.getOutputStream().apply {
                val request = "GET /health HTTP/1.1\r\nHost: 127.0.0.1:$port\r\nConnection: close\r\nAccept: application/json\r\n\r\n"
                write(request.toByteArray(Charsets.US_ASCII))
                flush()
            }
            val raw = readHttp(socket)
            parseResponse(raw)
        } catch (error: Exception) {
            ProbeOutcome(failureReason = describeFailure(error))
        } finally {
            runCatching { socket.close() }
        }
    }

    private fun readHttp(socket: Socket): ByteArray {
        val input = socket.getInputStream()
        val buffer = ByteArrayOutputStream()
        val chunk = ByteArray(2048)
        try {
            while (buffer.size() < MAX_RESPONSE_BYTES) {
                val read = input.read(chunk)
                if (read < 0) break
                buffer.write(chunk, 0, read)
                if (responseComplete(buffer.toByteArray())) break
            }
        } catch (timeout: SocketTimeoutException) {
            if (!responseComplete(buffer.toByteArray())) throw timeout
        }
        return buffer.toByteArray()
    }

    private fun responseComplete(raw: ByteArray): Boolean {
        val headerEnd = indexOf(raw, HEADER_SEP)
        if (headerEnd < 0) return false
        val header = String(raw, 0, headerEnd, Charsets.US_ASCII)
        val contentLength = CONTENT_LENGTH.find(header)?.groupValues?.getOrNull(1)?.toIntOrNull()
            ?: return true
        val bodyLength = raw.size - (headerEnd + HEADER_SEP.size)
        return bodyLength >= contentLength
    }

    private fun parseResponse(raw: ByteArray): ProbeOutcome {
        val headerEnd = indexOf(raw, HEADER_SEP)
        if (headerEnd < 0) {
            return ProbeOutcome(failureReason = "HTTP response incomplete ${snippet(raw.decodeToString())}")
        }
        val header = String(raw, 0, headerEnd, Charsets.US_ASCII)
        val body = String(raw, headerEnd + HEADER_SEP.size, raw.size - headerEnd - HEADER_SEP.size, Charsets.UTF_8)
        val statusLine = header.lineSequence().firstOrNull().orEmpty()
        val code = statusLine.split(' ').getOrNull(1)?.toIntOrNull()
        if (code == null) {
            return ProbeOutcome(failureReason = "HTTP status unreadable ${snippet(statusLine)}")
        }
        if (code != 200) {
            return ProbeOutcome(failureReason = "HTTP $code ${snippet(body)}".trim())
        }
        if (!body.contains("\"ok\":true") && !body.contains("\"ok\": true")) {
            return ProbeOutcome(failureReason = "HTTP $code ${snippet(body)}".trim())
        }
        return ProbeOutcome(
            snapshot = HealthSnapshot(
                version = jsonString(body, "version"),
                nfcAvailable = jsonBoolean(body, "nfcAvailable"),
                tapToPayReady = jsonBoolean(body, "tapToPayReady"),
                tapToPayMessage = jsonString(body, "tapToPayMessage"),
                hasAdyenSdk = jsonBoolean(body, "hasAdyenSdk"),
            ),
        )
    }

    private fun describeFailure(error: Exception): String {
        val message = error.message?.trim().orEmpty()
        val kind = when (error) {
            is SocketTimeoutException -> "timeout"
            is ConnectException -> "connection refused"
            else -> error.javaClass.simpleName
        }
        return if (message.isBlank() || message.equals(kind, ignoreCase = true)) {
            kind
        } else {
            "$kind: $message"
        }
    }

    private fun snippet(text: String): String {
        val clean = text.replace("\r", " ").replace("\n", " ").trim()
        if (clean.isEmpty()) return ""
        return clean.take(180)
    }

    private fun indexOf(haystack: ByteArray, needle: ByteArray): Int {
        if (needle.isEmpty() || haystack.size < needle.size) return -1
        val last = haystack.size - needle.size
        for (start in 0..last) {
            var matched = true
            for (offset in needle.indices) {
                if (haystack[start + offset] != needle[offset]) {
                    matched = false
                    break
                }
            }
            if (matched) return start
        }
        return -1
    }

    private fun jsonString(body: String, key: String): String? =
        Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(body)?.groupValues?.getOrNull(1)

    private fun jsonBoolean(body: String, key: String): Boolean? =
        when {
            body.contains("\"$key\":true") || body.contains("\"$key\": true") -> true
            body.contains("\"$key\":false") || body.contains("\"$key\": false") -> false
            else -> null
        }

    data class ProbeOutcome(
        val snapshot: HealthSnapshot? = null,
        val failureReason: String? = null,
    )

    data class HealthSnapshot(
        val version: String? = null,
        val nfcAvailable: Boolean? = null,
        val tapToPayReady: Boolean? = null,
        val tapToPayMessage: String? = null,
        val hasAdyenSdk: Boolean? = null,
    )

    private val HEADER_SEP = "\r\n\r\n".toByteArray(Charsets.US_ASCII)
    private val CONTENT_LENGTH = Regex("(?i)Content-Length:\\s*(\\d+)")
}
