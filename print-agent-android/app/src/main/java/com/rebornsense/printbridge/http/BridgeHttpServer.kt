package com.rebornsense.printbridge.http

import android.content.Context
import com.rebornsense.printbridge.BuildConfig
import com.rebornsense.printbridge.device.DeviceProfiler
import com.rebornsense.printbridge.print.NiimbotPrintClient
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrintJobQueue
import com.rebornsense.printbridge.payment.PaymentCoordinator
import com.rebornsense.printbridge.payment.TapToPayAuthParams
import com.rebornsense.printbridge.payment.TapToPayEngines
import com.rebornsense.printbridge.payment.TapToPaySaleParams
import com.rebornsense.printbridge.payment.TapToPaySaleOutcome
import com.rebornsense.printbridge.setup.OemSetupPreferences
import com.rebornsense.printbridge.payment.hasNfcFeature
import com.rebornsense.printbridge.scale.AclasScaleReader
import com.rebornsense.printbridge.scale.AclasScaleReading
import fi.iki.elonen.NanoHTTPD
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
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
                if (registry.list().any { it.connectionType == "bluetooth" }) {
                    features.put("bluetooth")
                    features.put("bt-cut-trailer")
                }
                if (registry.list().any { it.connectionType == "lan" }) features.put("lan")
                features.put("niimbot-label")

                val engine = TapToPayEngines.current()
                val nfcAvailable = appContext.hasNfcFeature()
                val deviceRegistered = OemSetupPreferences.isTapToPayDeviceRegistered(appContext)
                val sdkReady = engine.isReady()
                val tapToPayReady = nfcAvailable && sdkReady && deviceRegistered
                val tapToPayMessage = when {
                    !nfcAvailable -> "This device has no NFC reader."
                    tapToPayReady -> "Ready"
                    else -> engine.readinessMessage(appContext)
                }
                if (nfcAvailable) features.put("nfc")
                if (sdkReady) features.put("tap-to-pay-sdk")
                if (tapToPayReady) features.put("tap-to-pay")
                features.put("scale")
                features.put("usb-scale")

                jsonResponse(
                    JSONObject()
                        .put("ok", true)
                        .put("version", BuildConfig.VERSION_NAME)
                        .put("platform", "android")
                        .put("deviceProfile", DeviceProfiler.deviceProfileId())
                        .put("manufacturer", android.os.Build.MANUFACTURER)
                        .put("model", android.os.Build.MODEL)
                        .put("features", features)
                        .put("printerReady", registry.hasReadyPrinter())
                        .put("queueDepth", queue.queueDepth())
                        .put("nfcAvailable", nfcAvailable)
                        .put("hasAdyenSdk", BuildConfig.HAS_ADYEN_SDK)
                        .put("tapToPayRegistered", deviceRegistered)
                        .put("tapToPayReady", tapToPayReady)
                        .put("tapToPayMessage", tapToPayMessage)
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

            uri == "/print/niimbot-label" && method == Method.POST -> {
                val body = readBody(session)
                val printerName = body.optString("printerName", "")
                val bitmapBase64 = body.optString("bitmapBase64", "")
                val widthPx = body.optInt("widthPx", 0)
                val heightPx = body.optInt("heightPx", 0)
                val density = body.optInt("density", 3)
                if (bitmapBase64.isBlank() || widthPx <= 0 || heightPx <= 0) {
                    return jsonResponse(
                        JSONObject().put("ok", false).put("error", "bitmapBase64, widthPx, heightPx required"),
                        Response.Status.BAD_REQUEST
                    )
                }
                val endpoint = registry.findByName(printerName)
                    ?: return jsonResponse(
                        JSONObject().put("ok", false).put("error", "No printer available"),
                        Response.Status.BAD_REQUEST
                    )
                val bytes = try {
                    PrintJobQueue.decodeBase64(bitmapBase64)
                } catch (e: Exception) {
                    return jsonResponse(
                        JSONObject().put("ok", false).put("error", "Invalid base64"),
                        Response.Status.BAD_REQUEST
                    )
                }
                val result = NiimbotPrintClient.print(
                    appContext,
                    endpoint,
                    registry,
                    bytes,
                    widthPx,
                    heightPx,
                    density,
                )
                if (result.isSuccess) {
                    jsonResponse(JSONObject().put("ok", true).put("printer", endpoint.name))
                } else {
                    jsonResponse(
                        JSONObject().put("ok", false).put("error", result.exceptionOrNull()?.message ?: "Niimbot print failed"),
                        Response.Status.INTERNAL_ERROR
                    )
                }
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

            uri == "/tap-to-pay/register" && method == Method.POST -> {
                val body = readBody(session)
                val apiBaseUrl = body.optString("api_base_url", "")
                val authToken = body.optString("auth_token", "")
                if (apiBaseUrl.isBlank() || authToken.isBlank()) {
                    return jsonResponse(
                        JSONObject()
                            .put("ok", false)
                            .put("error", "api_base_url and auth_token are required"),
                        Response.Status.BAD_REQUEST,
                    )
                }
                if (!appContext.hasNfcFeature()) {
                    return jsonResponse(
                        JSONObject()
                            .put("ok", false)
                            .put("error", "This device has no NFC reader."),
                        Response.Status.BAD_REQUEST,
                    )
                }
                val engine = TapToPayEngines.current()
                val outcome = runBlocking {
                    withTimeoutOrNull(120_000L) {
                        engine.registerDevice(
                            appContext,
                            TapToPayAuthParams(apiBaseUrl = apiBaseUrl, authToken = authToken),
                        )
                    }
                } ?: return jsonResponse(
                    JSONObject().put("ok", false).put("error", "Tap to Pay setup timed out."),
                    Response.Status.REQUEST_TIMEOUT,
                )
                jsonResponse(
                    JSONObject()
                        .put("ok", outcome.ok)
                        .put("installation_id", outcome.installationId)
                        .put("message", outcome.message),
                    if (outcome.ok) Response.Status.OK else Response.Status.BAD_REQUEST,
                )
            }

            uri == "/tap-to-pay" && method == Method.POST -> {
                val body = readBody(session)
                val amountMinor = body.optLong("amount_minor", 0L)
                val currency = body.optString("currency", "CHF")
                val apiBaseUrl = body.optString("api_base_url", "")
                val authToken = body.optString("auth_token", "")
                val reference = body.optString("reference", "").takeIf { it.isNotBlank() }
                if (amountMinor <= 0L || apiBaseUrl.isBlank() || authToken.isBlank()) {
                    return jsonResponse(
                        JSONObject()
                            .put("ok", false)
                            .put("status", "error")
                            .put("error", "amount_minor, api_base_url, and auth_token are required"),
                        Response.Status.BAD_REQUEST,
                    )
                }
                if (!appContext.hasNfcFeature()) {
                    return jsonResponse(
                        JSONObject()
                            .put("ok", false)
                            .put("status", "error")
                            .put("error", "This device has no NFC reader."),
                        Response.Status.BAD_REQUEST,
                    )
                }
                val params = TapToPaySaleParams(
                    amountMinor = amountMinor,
                    currency = currency,
                    apiBaseUrl = apiBaseUrl,
                    authToken = authToken,
                    reference = reference,
                )
                val deferred = PaymentCoordinator.beginSale(appContext, params)
                val outcome = runBlocking {
                    withTimeoutOrNull(170_000L) { deferred.await() }
                } ?: TapToPaySaleOutcome(
                    ok = false,
                    status = "cancelled",
                    message = "Payment timed out.",
                )
                jsonResponse(
                    JSONObject()
                        .put("ok", outcome.ok)
                        .put("status", outcome.status)
                        .put("reference", outcome.reference)
                        .put("message", outcome.message),
                    if (outcome.ok) Response.Status.OK else Response.Status.BAD_REQUEST,
                )
            }

            uri == "/scale/ports" && method == Method.GET -> {
                val devices = AclasScaleReader.listDevices(appContext)
                val arr = JSONArray()
                devices.forEach { device ->
                    arr.put(
                        JSONObject()
                            .put("port", device.stableAddress)
                            .put("name", device.displayName)
                            .put("caption", device.displayName)
                            .put("usbAddress", device.stableAddress)
                            .put("connectionType", "usb")
                            .put("hasPermission", device.hasPermission)
                    )
                }
                jsonResponse(
                    JSONObject()
                        .put("ok", true)
                        .put("ports", JSONArray())
                        .put("devices", arr)
                )
            }

            uri == "/scale/reading" && method == Method.GET -> {
                val usbAddress = queryParam(session, "usbAddress")
                    .ifBlank { queryParam(session, "address") }
                    .ifBlank {
                        val port = queryParam(session, "port")
                        if (port.startsWith("usb:", ignoreCase = true)) port else ""
                    }
                val timeoutMs = queryParam(session, "timeoutMs").toLongOrNull()?.coerceIn(300L, 5000L) ?: 1200L
                if (usbAddress.isBlank()) {
                    return jsonResponse(
                        JSONObject().put("ok", false).put("error", "usbAddress query param required"),
                        Response.Status.BAD_REQUEST
                    )
                }
                val outcome = runBlocking {
                    withTimeoutOrNull(timeoutMs + 800L) {
                        AclasScaleReader.readOnce(appContext, usbAddress, timeoutMs)
                    }
                }
                when {
                    outcome == null -> jsonResponse(
                        JSONObject()
                            .put("ok", true)
                            .put("reading", JSONObject.NULL)
                            .put("message", "Scale read timed out")
                    )
                    outcome.isSuccess -> {
                        val data = outcome.getOrThrow()
                        jsonResponse(
                            JSONObject()
                                .put("ok", true)
                                .put("reading", scaleReadingJson(data.reading))
                                .put("resolvedUsbAddress", data.resolvedUsbAddress)
                                .put("resolvedPort", data.resolvedUsbAddress)
                        )
                    }
                    else -> jsonResponse(
                        JSONObject()
                            .put("ok", true)
                            .put("reading", JSONObject.NULL)
                            .put(
                                "message",
                                outcome.exceptionOrNull()?.message ?: "Scale read failed"
                            )
                    )
                }
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

    private fun queryParam(session: IHTTPSession, name: String): String {
        return session.parameters[name]?.firstOrNull()?.trim().orEmpty()
    }

    private fun scaleReadingJson(reading: AclasScaleReading): JSONObject {
        return JSONObject()
            .put("weightKg", reading.weightKg)
            .put("rawWeight", reading.rawWeight)
            .put("units", reading.units)
            .put("status", reading.status.name)
            .put("isZero", reading.isZero)
            .put("isTare", reading.isTare)
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
}
