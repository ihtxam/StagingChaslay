package com.rebornsense.printbridge.payment

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.atomic.AtomicReference

object PaymentCoordinator {
    private val pendingParams = AtomicReference<TapToPaySaleParams?>(null)
    private val pendingResult = AtomicReference<CompletableDeferred<TapToPaySaleOutcome>?>(null)

    fun beginSale(context: Context, params: TapToPaySaleParams): CompletableDeferred<TapToPaySaleOutcome> {
        val previous = pendingResult.getAndSet(null)
        previous?.complete(
            TapToPaySaleOutcome(ok = false, status = "cancelled", message = "Replaced by a new payment."),
        )
        pendingParams.set(params)
        val deferred = CompletableDeferred<TapToPaySaleOutcome>()
        pendingResult.set(deferred)
        val intent = Intent(context, PaymentActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return deferred
    }

    fun consumePendingParams(intent: Intent): TapToPaySaleParams? {
        return pendingParams.getAndSet(null)
    }

    fun complete(outcome: TapToPaySaleOutcome) {
        pendingResult.getAndSet(null)?.complete(outcome)
    }
}
