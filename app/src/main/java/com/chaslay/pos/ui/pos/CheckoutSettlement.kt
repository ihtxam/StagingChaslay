package com.chaslay.pos.ui.pos

import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentTender

fun isCheckoutCardMethod(method: PaymentMethod?): Boolean =
    method == PaymentMethod.CARD ||
        method == PaymentMethod.ADYEN_TERMINAL ||
        method == PaymentMethod.TAP_TO_PAY

fun checkoutCommittedPaid(state: CheckoutState): Double =
    state.appliedTenders.sumOf { it.amount }

fun checkoutPendingLineAmount(state: CheckoutState, tenderBuffer: String): Double {
    tenderBuffer.toDoubleOrNull()?.takeIf { it > 0.001 }?.let { return it }
    if (state.cardTenderAmount > 0.001) return state.cardTenderAmount
    if (state.tenderAmount > 0.001) return state.tenderAmount
    return 0.0
}

fun checkoutEffectivePaid(state: CheckoutState, tenderBuffer: String): Double =
    checkoutCommittedPaid(state) + checkoutPendingLineAmount(state, tenderBuffer)

fun checkoutRemainingDue(total: Double, state: CheckoutState, tenderBuffer: String): Double =
    (total - checkoutEffectivePaid(state, tenderBuffer)).coerceAtLeast(0.0)

fun checkoutChangeDue(total: Double, state: CheckoutState, tenderBuffer: String): Double {
    val paid = checkoutEffectivePaid(state, tenderBuffer)
    val cardLocked = state.appliedTenders.any { isCheckoutCardMethod(it.method) } ||
        state.cardTenderAmount > 0.001 ||
        (isCheckoutCardMethod(state.method) && checkoutPendingLineAmount(state, tenderBuffer) > 0.001)
    if (cardLocked && paid > total + 0.001) return 0.0
    return (paid - total).coerceAtLeast(0.0)
}

/** Resolved card/terminal charge after cash and committed card portions. */
fun resolveCheckoutCardCharge(checkout: CheckoutState, roundedTotal: Double): Double {
    val cashFromApplied = checkout.appliedTenders
        .filter { it.method == PaymentMethod.CASH }
        .sumOf { it.amount }
    val cardFromApplied = checkout.appliedTenders
        .filter { isCheckoutCardMethod(it.method) }
        .sumOf { it.amount }
    val pendingCash = if (checkout.method == PaymentMethod.CASH) checkout.tenderAmount else 0.0
    val pendingCard = when {
        checkout.cardTenderAmount > 0.001 -> checkout.cardTenderAmount
        isCheckoutCardMethod(checkout.method) && checkout.tenderAmount > 0.001 -> checkout.tenderAmount
        else -> 0.0
    }
    if (pendingCard > 0.001) return pendingCard
    return (roundedTotal - cashFromApplied - pendingCash - cardFromApplied).coerceAtLeast(0.0)
}

fun buildCheckoutPaymentTenders(
    checkout: CheckoutState,
    roundedTotal: Double,
    resolvedMethod: PaymentMethod,
    terminalTipFromDevice: Double = 0.0,
): List<PaymentTender> {
    val out = checkout.appliedTenders.toMutableList()
    when {
        checkout.method == PaymentMethod.CASH && checkout.tenderAmount > 0.001 ->
            out.add(PaymentTender(PaymentMethod.CASH, checkout.tenderAmount))
        checkout.cardTenderAmount > 0.001 -> {
            val cardMethod = when (resolvedMethod) {
                PaymentMethod.ADYEN_TERMINAL -> PaymentMethod.ADYEN_TERMINAL
                PaymentMethod.TAP_TO_PAY -> PaymentMethod.TAP_TO_PAY
                else -> PaymentMethod.CARD
            }
            out.add(PaymentTender(cardMethod, checkout.cardTenderAmount + terminalTipFromDevice))
        }
        isCheckoutCardMethod(checkout.method) && checkout.tenderAmount > 0.001 -> {
            val cardMethod = when (resolvedMethod) {
                PaymentMethod.ADYEN_TERMINAL -> PaymentMethod.ADYEN_TERMINAL
                PaymentMethod.TAP_TO_PAY -> PaymentMethod.TAP_TO_PAY
                else -> PaymentMethod.CARD
            }
            out.add(PaymentTender(cardMethod, checkout.tenderAmount + terminalTipFromDevice))
        }
        isCheckoutCardMethod(resolvedMethod) -> {
            val charge = resolveCheckoutCardCharge(checkout, roundedTotal) + terminalTipFromDevice
            if (charge > 0.001) {
                val cardMethod = when (resolvedMethod) {
                    PaymentMethod.ADYEN_TERMINAL -> PaymentMethod.ADYEN_TERMINAL
                    PaymentMethod.TAP_TO_PAY -> PaymentMethod.TAP_TO_PAY
                    else -> PaymentMethod.CARD
                }
                out.add(PaymentTender(cardMethod, charge))
            }
        }
        resolvedMethod == PaymentMethod.CASH && checkout.tenderAmount < 0.001 &&
            out.none { it.method == PaymentMethod.CASH } ->
            out.add(PaymentTender(PaymentMethod.CASH, roundedTotal))
    }
    return out.filter { it.amount > 0.001 }
}

fun checkoutCashTenderForReceipt(
    tenders: List<PaymentTender>,
    roundedTotal: Double,
): Double? {
    val cashTotal = tenders.filter { it.method == PaymentMethod.CASH }.sumOf { it.amount }
    if (cashTotal > 0.001) return cashTotal
    return if (tenders.isEmpty()) roundedTotal else null
}

fun checkoutChangeFromTenders(tenders: List<PaymentTender>, roundedTotal: Double): Double {
    val paid = tenders.sumOf { it.amount }
    val hasCard = tenders.any { isCheckoutCardMethod(it.method) }
    if (hasCard && paid > roundedTotal + 0.001) return 0.0
    return (paid - roundedTotal).coerceAtLeast(0.0)
}
