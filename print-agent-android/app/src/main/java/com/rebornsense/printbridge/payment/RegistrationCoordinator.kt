package com.rebornsense.printbridge.payment

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.atomic.AtomicReference

/** Launches a transparent activity so Adyen warmUp runs on the main thread with a registered launcher. */
object RegistrationCoordinator {
    private val pendingAuth = AtomicReference<TapToPayAuthParams?>(null)
    private val pendingResult = AtomicReference<CompletableDeferred<TapToPayRegisterOutcome>?>(null)

    fun beginRegister(context: Context, params: TapToPayAuthParams): CompletableDeferred<TapToPayRegisterOutcome> {
        pendingResult.getAndSet(null)?.complete(
            TapToPayRegisterOutcome(ok = false, message = "Replaced by a new registration request."),
        )
        pendingAuth.set(params)
        val deferred = CompletableDeferred<TapToPayRegisterOutcome>()
        pendingResult.set(deferred)
        val intent = Intent(context, TapToPayRegisterActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return deferred
    }

    fun consumePendingAuth(): TapToPayAuthParams? = pendingAuth.getAndSet(null)

    fun complete(outcome: TapToPayRegisterOutcome) {
        pendingResult.getAndSet(null)?.complete(outcome)
    }
}
