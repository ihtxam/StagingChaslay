package com.rebornsense.printbridge.http

import android.os.Build
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject

class BridgeHttpServer(port: Int) : NanoHTTPD("127.0.0.1", port) {
    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri ?: "/"
        val method = session.method

        return when {
            uri == "/health" && method == Method.GET -> jsonResponse(
                JSONObject()
                    .put("ok", true)
                    .put("version", "0.1.0")
                    .put("platform", "android")
                    .put("deviceProfile", detectProfile())
                    .put("manufacturer", Build.MANUFACTURER)
                    .put("model", Build.MODEL)
                    .put(
                        "features",
                        JSONArray(listOf("queue", "drawer"))
                    )
                    .put("printerReady", false)
                    .put("queueDepth", 0)
            )

            uri == "/printers" && method == Method.GET -> jsonResponse(
                JSONObject().put("printers", JSONArray())
            )

            uri == "/print" && method == Method.POST -> {
                val body = readBody(session)
                val printer = body.optString("printerName", "")
                jsonResponse(
                    JSONObject()
                        .put("ok", true)
                        .put("printer", printer.ifBlank { "default" })
                        .put("queued", true)
                        .put("message", "Print queued (driver plugins coming in next release)")
                )
            }

            uri == "/drawer" && method == Method.POST -> jsonResponse(
                JSONObject().put("ok", true)
            )

            else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found")
        }
    }

    private fun readBody(session: IHTTPSession): JSONObject {
        return try {
            val files = HashMap<String, String>()
            session.parseBody(files)
            val raw = files["postData"] ?: ""
            if (raw.isBlank()) JSONObject() else JSONObject(raw)
        } catch (_: Exception) {
            JSONObject()
        }
    }

    private fun jsonResponse(payload: JSONObject): Response {
        return newFixedLengthResponse(
            Response.Status.OK,
            "application/json",
            payload.toString()
        )
    }

    private fun detectProfile(): String {
        val manufacturer = Build.MANUFACTURER.orEmpty().uppercase()
        val model = Build.MODEL.orEmpty().uppercase()
        return when {
            manufacturer.contains("SUNMI") && model.contains("D3") -> "sunmi-d3-mini"
            manufacturer.contains("SUNMI") && model.contains("D2") -> "sunmi-d2s-plus"
            manufacturer.contains("FEITIAN") && model.contains("F310") -> "feitian-f310a"
            else -> "generic-android"
        }
    }
}
