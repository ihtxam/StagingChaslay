package com.rebornsense.printbridge.payment

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * Transparent host for one-time Tap to Pay registration (Adyen warmUp).
 * Started from the HTTP bridge — same pattern as [PaymentActivity] for sales.
 */
class TapToPayRegisterActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runCatching {
            Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenBootstrap")
                .getMethod("register", AppCompatActivity::class.java)
                .invoke(null, this)
        }
        val params = RegistrationCoordinator.consumePendingAuth()
        if (params == null) {
            RegistrationCoordinator.complete(
                TapToPayRegisterOutcome(ok = false, message = "No registration request."),
            )
            finish()
            return
        }

        lifecycleScope.launch {
            val outcome = try {
                TapToPayEngines.current().registerDevice(this@TapToPayRegisterActivity, params)
            } catch (t: Throwable) {
                TapToPayRegisterOutcome(
                    ok = false,
                    message = t.message ?: "Tap to Pay setup failed.",
                )
            }
            RegistrationCoordinator.complete(outcome)
            finish()
        }
    }
}
