package com.chaslay.pos.domain

import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentTenderNotes
import kotlin.math.max

/** Net collected per payment method key after refunds (matches EOD payment rows; tender-aware). */
object EodPaymentBuckets {
    fun netPaymentBucketsForTransaction(tx: TransactionEntity): Map<String, Double> {
        val total = tx.total.coerceAtLeast(0.0)
        val refund = tx.refundAmount.coerceAtLeast(0.0)
        val netOrder = max(0.0, total - refund)
        if (netOrder <= 0.0005) return emptyMap()

        val tenders = PaymentTenderNotes.parse(tx.notes)
        if (tenders.isEmpty()) {
            val key = PaymentTenderNotes.methodKey(tx.paymentMethod)
            return mapOf(key to netOrder)
        }

        val tenderSum = tenders.sumOf { it.amount }
        if (tenderSum <= 0.0005) {
            val key = PaymentTenderNotes.methodKey(tx.paymentMethod)
            return mapOf(key to netOrder)
        }

        val scale = netOrder / tenderSum
        val out = mutableMapOf<String, Double>()
        for (t in tenders) {
            if (t.amount <= 0.001) continue
            val key = PaymentTenderNotes.methodKey(t.method)
            val slice = t.amount * scale
            out[key] = (out[key] ?: 0.0) + slice
        }
        return out
    }

    fun cardBucketTotal(card: Double, terminal: Double): Double = card + terminal

    fun addBucket(
        buckets: MutableMap<String, Double>,
        methodKey: String,
        amount: Double
    ) {
        if (amount <= 0.0005) return
        buckets[methodKey] = (buckets[methodKey] ?: 0.0) + amount
    }

    fun netTaxableSale(tx: TransactionEntity): Double {
        val brut = max(0.0, tx.total - tx.tipAmount)
        val refund = tx.refundAmount.coerceAtLeast(0.0)
        return max(0.0, brut - minOf(refund, brut))
    }

    fun isCashKey(key: String): Boolean = key == "cash"

    fun isCardDisplayKey(key: String): Boolean =
        key == "card" || key == "terminal"

    fun isTapToPayKey(key: String): Boolean = key == "tap_to_pay"

    fun paymentMethodFromKey(key: String): PaymentMethod? = when (key) {
        "cash" -> PaymentMethod.CASH
        "card" -> PaymentMethod.CARD
        "tap_to_pay" -> PaymentMethod.TAP_TO_PAY
        "terminal" -> PaymentMethod.ADYEN_TERMINAL
        else -> null
    }
}
