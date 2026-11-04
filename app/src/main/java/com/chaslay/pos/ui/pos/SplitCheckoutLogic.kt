package com.chaslay.pos.ui.pos

import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.roundMoney

data class SplitBillCardUi(
    val checkNumber: Int,
    val amount: Double,
    val itemCount: Int,
    val isPaid: Boolean,
    val paymentMethod: PaymentMethod?,
    val paidAt: Long?,
    val transactionId: String?
)

data class SplitCheckoutTotals(
    val orderTotal: Double,
    val paidTotal: Double,
    val remainingTotal: Double,
    val cards: List<SplitBillCardUi>
)

object SplitCheckoutLogic {

    fun compute(
        cart: CartSummary,
        equalSplitPaidCount: Int,
        paidOrders: List<TransactionEntity>
    ): SplitCheckoutTotals {
        val completed = paidOrders.filter {
            it.paymentStatus == PaymentStatus.COMPLETED ||
                it.paymentStatus == PaymentStatus.PARTIALLY_REFUNDED
        }
        val orderTotal = cart.total
        val checks = (1..cart.splitCount.coerceAtLeast(1)).toList()
        val cards = checks.map { check ->
            val tx = completed.firstOrNull { it.splitCheckNumber == check }
            val itemsOnCheck = cart.items.filter { it.splitCheck == check }
            val checkMerchandise = checkMerchandiseTotal(cart, check)
            val amount = when {
                cart.splitByItems && cart.splitCount > 1 -> checkMerchandise
                cart.splitCount > 1 -> orderTotal / cart.splitCount
                else -> orderTotal
            }
            val paidByCounter = !cart.splitByItems && cart.splitCount > 1 && check <= equalSplitPaidCount
            val paidByTx = tx != null
            val isPaid = paidByTx || paidByCounter
            SplitBillCardUi(
                checkNumber = check,
                amount = if (paidByTx) tx.total else amount,
                itemCount = itemsOnCheck.sumOf { it.quantity.coerceAtLeast(1) },
                isPaid = isPaid,
                paymentMethod = tx?.paymentMethod,
                paidAt = tx?.createdAt,
                transactionId = tx?.id
            )
        }
        val paidTotal = cards.filter { it.isPaid }.sumOf { it.amount }
        val remainingTotal = (orderTotal - paidTotal).coerceAtLeast(0.0)
        val adjustedCards = allocateRemainingToUnpaidCards(cart, cards, remainingTotal)
        return SplitCheckoutTotals(
            orderTotal = orderTotal,
            paidTotal = paidTotal,
            remainingTotal = remainingTotal,
            cards = adjustedCards
        )
    }

    fun tillSplitTotals(cart: CartSummary, equalSplitPaidCount: Int): Pair<Double, Double>? {
        if (cart.splitCount <= 1) return null
        val orderTotal = cart.total
        val paid = if (!cart.splitByItems) {
            (orderTotal / cart.splitCount) * equalSplitPaidCount.coerceAtLeast(0)
        } else {
            0.0
        }
        if (paid <= 0.005) return null
        return paid to (orderTotal - paid).coerceAtLeast(0.0)
    }

    /** Same VAT/discount basis as [CartSummary.total] for one split check. */
    private fun checkMerchandiseTotal(cart: CartSummary, check: Int): Double {
        if (cart.splitCount <= 1) return cart.total
        val itemsOnCheck = cart.items.filter { it.splitCheck == check }
        if (itemsOnCheck.isEmpty()) return 0.0
        return cart.copy(items = itemsOnCheck).total
    }

    /**
     * When earlier split payments exist on the same master order, unpaid invoice cards must
     * show the remaining balance (same basis as the sidebar), not the full check merchandise.
     */
    private fun allocateRemainingToUnpaidCards(
        cart: CartSummary,
        cards: List<SplitBillCardUi>,
        remainingTotal: Double
    ): List<SplitBillCardUi> {
        val unpaid = cards.filter { !it.isPaid }
        if (unpaid.isEmpty() || remainingTotal <= 0.005) return cards
        val weights = unpaid.associate { card ->
            card.checkNumber to when {
                cart.splitByItems && cart.splitCount > 1 ->
                    checkMerchandiseTotal(cart, card.checkNumber).coerceAtLeast(0.0)
                cart.splitCount > 1 -> cart.total / cart.splitCount
                else -> card.amount.coerceAtLeast(0.0)
            }
        }
        val weightSum = weights.values.sum()
        return cards.map { card ->
            if (card.isPaid) {
                card
            } else {
                val share = when {
                    weightSum > 0.005 -> remainingTotal * (weights[card.checkNumber]!! / weightSum)
                    unpaid.size == 1 -> remainingTotal
                    else -> remainingTotal / unpaid.size
                }
                card.copy(amount = roundMoney(share))
            }
        }
    }
}
