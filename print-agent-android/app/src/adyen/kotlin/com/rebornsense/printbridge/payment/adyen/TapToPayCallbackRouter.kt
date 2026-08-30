package com.rebornsense.printbridge.payment.adyen

import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import com.adyen.ipp.api.payment.PaymentResult as AdyenPaymentResult
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.atomic.AtomicReference

object TapToPayCallbackRouter {
    @Volatile var launcher: ActivityResultLauncher<Intent>? = null

    private val pending = AtomicReference<CompletableDeferred<TapToPayCallbackResult>?>(null)

    fun arm(deferred: CompletableDeferred<TapToPayCallbackResult>) {
        val previous = pending.getAndSet(deferred)
        previous?.complete(TapToPayCallbackResult(ok = false, message = "Replaced by a new payment."))
    }

    fun onSuccess(result: AdyenPaymentResult) {
        val deferred = pending.getAndSet(null) ?: return
        deferred.complete(
            if (result.success) {
                TapToPayCallbackResult(ok = true, reference = result.data?.takeIf { it.isNotBlank() })
            } else {
                TapToPayCallbackResult(ok = false, message = "Tap to Pay was declined.")
            },
        )
    }

    fun onFailure(error: Throwable) {
        val deferred = pending.getAndSet(null) ?: return
        deferred.complete(TapToPayCallbackResult(ok = false, message = error.message ?: "Tap to Pay failed."))
    }
}

data class TapToPayCallbackResult(
    val ok: Boolean,
    val reference: String? = null,
    val message: String? = null,
)
