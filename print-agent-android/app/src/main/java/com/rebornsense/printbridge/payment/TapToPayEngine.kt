package com.rebornsense.printbridge.payment

import android.app.Activity

data class TapToPaySaleParams(
    val amountMinor: Long,
    val currency: String,
    val apiBaseUrl: String,
    val authToken: String,
    val reference: String?,
)

data class TapToPaySaleOutcome(
    val ok: Boolean,
    val status: String,
    val reference: String? = null,
    val message: String? = null,
)

/** Pluggable NFC payment backend (Adyen when SDK is on the classpath). */
interface TapToPayEngine {
    fun isReady(): Boolean
    fun readinessMessage(): String
    suspend fun processSale(activity: Activity, params: TapToPaySaleParams): TapToPaySaleOutcome
}

object TapToPayEngines {
  private val adyenEngine: TapToPayEngine? by lazy {
    runCatching {
      val clazz = Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenTapToPayEngine")
      clazz.getDeclaredConstructor().newInstance() as TapToPayEngine
    }.getOrNull()
  }

  fun current(): TapToPayEngine = adyenEngine ?: TapToPayEngineStub()
}
