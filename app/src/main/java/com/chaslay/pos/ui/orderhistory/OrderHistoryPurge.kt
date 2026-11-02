package com.chaslay.pos.ui.orderhistory

import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.PaymentTender
import com.chaslay.pos.domain.model.PaymentTenderNotes

/** Aligns with Web Gandola purge: completed, fully paid, cash-only tickets. */
object OrderHistoryPurge {

    fun isGandolaPurgeEligible(order: TransactionEntity): Boolean =
        isCompletedPaidCashOrder(order) && isCashOnlyOrder(order)

    private fun orderNetTotal(order: TransactionEntity): Double {
        val refunded = order.refundAmount.coerceAtLeast(0.0)
        return (order.total - refunded).coerceAtLeast(0.0)
    }

    private fun isCompletedPaidCashOrder(order: TransactionEntity): Boolean {
        if (order.paymentStatus != PaymentStatus.COMPLETED) return false
        if (isExcludedPrimaryMethod(order.paymentMethod)) return false

        val tenders = PaymentTenderNotes.parse(order.notes)
        for (tender in tenders) {
            if (isExcludedTenderMethod(tender)) return false
        }
        return true
    }

    private fun isCashOnlyOrder(order: TransactionEntity): Boolean {
        val net = orderNetTotal(order)
        if (net <= 0.005) return false

        val tenders = PaymentTenderNotes.parse(order.notes)
        if (tenders.isEmpty()) {
            return order.paymentMethod == PaymentMethod.CASH
        }

        var cash = 0.0
        var nonCash = 0.0
        for (tender in tenders) {
            when (tender.method) {
                PaymentMethod.CASH -> cash += tender.amount
                PaymentMethod.CARD,
                PaymentMethod.TAP_TO_PAY,
                PaymentMethod.ADYEN_TERMINAL,
                PaymentMethod.GIFT_CARD -> nonCash += tender.amount
                else -> nonCash += tender.amount
            }
        }
        if (nonCash > 0.001) return false
        return cash >= net - 0.01
    }

    private fun isExcludedPrimaryMethod(method: PaymentMethod): Boolean = when (method) {
        PaymentMethod.PAY_LATER,
        PaymentMethod.INVOICE -> true
        else -> false
    }

    private fun isExcludedTenderMethod(tender: PaymentTender): Boolean = when (tender.method) {
        PaymentMethod.PAY_LATER,
        PaymentMethod.INVOICE -> true
        else -> false
    }
}
