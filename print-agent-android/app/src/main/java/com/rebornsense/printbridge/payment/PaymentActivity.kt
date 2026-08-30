package com.rebornsense.printbridge.payment

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * Transparent host for Adyen Tap to Pay UI. Started from the HTTP bridge because
 * SoftPOS cannot run inside a background service.
 */
class PaymentActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val params = PaymentCoordinator.consumePendingParams(intent)
        if (params == null) {
            PaymentCoordinator.complete(
                TapToPaySaleOutcome(ok = false, status = "error", message = "No payment request."),
            )
            finish()
            return
        }

        lifecycleScope.launch {
            val outcome = try {
                TapToPayEngines.current().processSale(this@PaymentActivity, params)
            } catch (t: Throwable) {
                TapToPaySaleOutcome(
                    ok = false,
                    status = "error",
                    message = t.message ?: "Tap to Pay failed.",
                )
            }
            PaymentCoordinator.complete(outcome)
            finish()
        }
    }
}
