package com.rebornsense.printbridge.http

import android.content.Context
import android.os.Build
import com.rebornsense.printbridge.BuildConfig
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrintJobQueue
import com.rebornsense.printbridge.print.PrinterDriver
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject

class BridgeHttpServer(
    port: Int,
    private val appContext: Context,
    private val registry: DriverRegistry,
    private val queue: PrintJobQueue,
) : NanoHTTPD("127.0.0.1", port) {

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri ?: "/"
        val method = session.method

        if (method == Method.OPTIONS) {
            return corsResponse(
                newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, ""),
            )
        }

        return when {
            uri == "/health" && method == Method.GET -> {
                registry.refresh(appContext)
                val features = JSONArray()
                features.put("queue")
                features.put("drawer")
                if (registry.list().any { it.connectionType == "sunmi-internal" }) features.put("sunmi-internal")
                if (registry.list().any { it.connectionType == "usb" }) features.put("usb-host")
                if (registry.list().any { it.connectionType == "bluetooth" }) features.put("bluetooth")
                if (registry.list().any { it.connectionType == "lan" }) features.put("lan")

                jsonResponse(
                    JSONObject()
                        .put("ok", true)
                        .put("version", BuildConfig.VERSION_NAME)
                        .put("platform", "android")
                        .put("deviceProfile", detectProfile())
                        .put("manufacturer", Build.MANUFACTURER)
                        .put("model", Build.MODEL)
                        .put("features", features)
                        .put("printerReady", registry.hasReadyPrinter())
                        .put("queueDepth", queue.queueDepth())
                )
            }

            uri == "/printers" && method == Method.GET -> {
                val printers = registry.refresh(appContext).map { ep ->
                    JSONObject()
                        .put("name", ep.name)
                        .put("isDefault", ep.isDefault)
                        .put("connectionType", ep.connectionType)
                        .put("driver", ep.driverKey)
                }
                val arr = JSONArray()
                printers.forEach { arr.put(it) }
                jsonResponse(JSONObject().put("printers", arr))
            }

            uri == "/print" && method == Method.POST -> {
                val body = readBody(session)
                val printerName = body.optString("printerName", "")
                val dataBase64 = body.optString("dataBase64", "")
                if (dataBase64.isBlank()) {
                    return jsonResponse(
                        JSONObject().put("ok", false).put("error", "dataBase64 is required"),
                        Response.Status.BAD_REQUEST
                    )
                }
                val endpoint = registry.findByName(printerName)
                    ?: return jsonResponse(
                        JSONObject().put("ok", false).put("error", "No printer available"),
                        Response.Status.BAD_REQUEST
                    )
                val bytes = try {
                    PrintJobQueue.decodeBase64(dataBase64)
                } catch (e: Exception) {
                    return jsonResponse(
                        JSONObject().put("ok", false).put("error", "Invalid base64"),
                        Response.Status.BAD_REQUEST
                    )
                }
                queue.enqueue(appContext, endpoint, bytes)
                jsonResponse(
                    JSONObject()
                        .put("ok", true)
                        .put("printer", endpoint.name)
                        .put("queued", true)
                )
            }

            uri == "/drawer" && method == Method.POST -> {
                val body = readBody(session)
                val printerName = body.optString("printerName", "")
                val endpoint = registry.findByName(printerName)
                    ?: return jsonResponse(
                        JSONObject().put("ok", false).put("error", "No printer available"),
                        Response.Status.BAD_REQUEST
                    )
                val driver = registry.driverFor(endpoint)
                    ?: return jsonResponse(
                        JSONObject().put("ok", false).put("error", "Driver missing"),
                        Response.Status.BAD_REQUEST
                    )
                val result = driver.kickDrawer(appContext, endpoint)
                if (result.isSuccess) {
                    jsonResponse(JSONObject().put("ok", true).put("printer", endpoint.name))
                } else {
                    jsonResponse(
                        JSONObject().put("ok", false).put("error", result.exceptionOrNull()?.message ?: "Drawer failed"),
                        Response.Status.INTERNAL_ERROR
                    )
                }
            }

            else -> corsResponse(
                newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found"),
            )
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

    private fun jsonResponse(payload: JSONObject, status: Response.Status = Response.Status.OK): Response {
        return corsResponse(newFixedLengthResponse(status, "application/json", payload.toString()))
    }

    /** Match Windows print-agent CORS so HTTPS WebPOS can call localhost:9101. */
    private fun corsResponse(response: Response): Response {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Content-Type")
        return response
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
