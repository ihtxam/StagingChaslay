package com.chaslay.pos.ui.orderhistory

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import java.util.Locale

/** Compact payment-status label for filter chips and table rows. */
@Composable
fun orderHistoryPaymentStatusChipLabel(status: PaymentStatus): String = when (status) {
    PaymentStatus.COMPLETED -> stringResource(R.string.order_history_status_done)
    PaymentStatus.REFUNDED -> stringResource(R.string.order_history_status_refund)
    PaymentStatus.CANCELLED -> stringResource(R.string.order_history_status_cancelled)
    PaymentStatus.PARTIALLY_REFUNDED -> stringResource(R.string.order_history_status_partial)
    else -> status.name.replace('_', ' ').take(6)
}

/** Full payment-status label for order detail. */
@Composable
fun orderHistoryPaymentStatusDetailLabel(status: PaymentStatus): String = when (status) {
    PaymentStatus.COMPLETED -> stringResource(R.string.order_history_status_completed)
    PaymentStatus.REFUNDED -> stringResource(R.string.order_history_status_refunded)
    PaymentStatus.PARTIALLY_REFUNDED -> stringResource(R.string.order_history_status_partial_refund)
    PaymentStatus.CANCELLED -> stringResource(R.string.order_history_status_cancelled_full)
    else -> status.name.replace('_', ' ')
}

@Composable
fun orderHistoryPaymentMethodChipLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> stringResource(R.string.cash)
    PaymentMethod.CARD -> stringResource(R.string.card)
    PaymentMethod.TAP_TO_PAY -> stringResource(R.string.payment_tap_short)
    PaymentMethod.ADYEN_TERMINAL -> stringResource(R.string.payment_terminal_short)
    PaymentMethod.PAY_LATER -> stringResource(R.string.pay_later_short)
    PaymentMethod.INVOICE -> stringResource(R.string.invoice)
    PaymentMethod.GIFT_CARD -> stringResource(R.string.payment_gift_card_short)
}

@Composable
fun orderHistoryPaymentMethodDetailLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> stringResource(R.string.cash)
    PaymentMethod.CARD -> stringResource(R.string.card)
    PaymentMethod.TAP_TO_PAY -> stringResource(R.string.tap_to_pay_method)
    PaymentMethod.ADYEN_TERMINAL -> stringResource(R.string.terminal)
    PaymentMethod.PAY_LATER -> stringResource(R.string.pay_later)
    PaymentMethod.INVOICE -> stringResource(R.string.invoice)
    PaymentMethod.GIFT_CARD -> stringResource(R.string.payment_gift_card)
}

@Composable
fun orderHistoryServiceTypeChipLabel(serviceType: ServiceType?): String {
    val label = when (serviceType) {
        ServiceType.DINE_IN -> stringResource(R.string.dine_in)
        ServiceType.TAKEAWAY -> stringResource(R.string.takeaway)
        else -> stringResource(R.string.walk_in)
    }
    return label.uppercase(Locale.getDefault())
}
