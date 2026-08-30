package com.rebornsense.printbridge.payment.adyen

import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.adyen.ipp.api.InPersonPayments
import com.adyen.ipp.api.payment.PaymentCallback

object AdyenBootstrap {
    private const val TAG = "AdyenBootstrap"

    fun register(activity: AppCompatActivity) {
        try {
            TapToPayCallbackRouter.launcher = InPersonPayments.registerForPaymentResult(
                activity,
                PaymentCallback { result ->
                    @Suppress("UNCHECKED_CAST")
                    (result as Result<com.adyen.ipp.api.payment.PaymentResult>).fold(
                        onSuccess = { paymentResult -> TapToPayCallbackRouter.onSuccess(paymentResult) },
                        onFailure = { error -> TapToPayCallbackRouter.onFailure(error) },
                    )
                },
            )
        } catch (t: Throwable) {
            Log.e(TAG, "Tap to Pay launcher registration failed", t)
        }
    }
}
