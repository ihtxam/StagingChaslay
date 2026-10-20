package com.chaslay.pos.payment.taptopay

import android.app.Activity
import android.app.Application
import androidx.activity.ComponentActivity
import com.chaslay.pos.payment.PaymentResult
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stand-in used when the build has no Adyen SDK on the classpath. Every entry
 * point is inert, so the POS runs normally with Tap to Pay reported unavailable
 * and card sales falling through to the terminal or the plain CARD tender.
 */
@Singleton
class NoopTapToPayEngine @Inject constructor() : TapToPayEngine {

    override fun isSupported(): Boolean = false

    override suspend fun readiness(): TapToPayReadiness = TapToPayReadiness.NO_SDK

    override suspend fun registerDevice(): TapToPayRegisterResult = TapToPayRegisterResult(
        ok = false,
        message = "This build does not include Tap to Pay.",
    )

    override fun initialize(application: Application) = Unit

    override suspend fun initializeWhileVisible(activity: ComponentActivity): Boolean = false

    override fun registerForPaymentResult(activity: ComponentActivity) = Unit

    override suspend fun warmUp() = Unit

    override suspend fun processPayment(
        activity: Activity,
        amount: Double,
        currencyCode: String,
        reference: String?,
    ): PaymentResult = PaymentResult.Failure(
        "This build does not include Tap to Pay. Install the Tap to Pay build from the merchant panel."
    )
}
