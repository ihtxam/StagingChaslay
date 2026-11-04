package com.chaslay.pos.ui.pos

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.RefundReasonLabels
import com.chaslay.pos.ui.auth.PinDotsDisplay
import com.chaslay.pos.ui.auth.PinLoginKeypad
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.posUiColors

enum class SplitBillActionMode {
    CANCEL_PAYMENT,
    REFUND
}

@Composable
fun SplitBillActionDialog(
    card: SplitBillCardUi,
    currencySymbol: String,
    cashierName: String,
    languageCode: String,
    busy: Boolean,
    pinError: String?,
    onDismiss: () -> Unit,
    onConfirm: (mode: SplitBillActionMode, pin: String, refundReasonId: String, refundNote: String) -> Unit
) {
    var mode by remember { mutableStateOf(SplitBillActionMode.CANCEL_PAYMENT) }
    var pin by remember { mutableStateOf("") }
    var refundReasonId by remember { mutableStateOf(RefundReasonLabels.options.first().id) }
    var refundNote by remember { mutableStateOf("") }
    var printRefundReceipt by remember { mutableStateOf(true) }
    val reasons = remember(languageCode) { RefundReasonLabels.localizedOptions(languageCode) }
    val ui = posUiColors()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .verticalScroll(rememberScrollState())
                .padding(8.dp)
                .border(1.dp, ui.border, RoundedCornerShape(12.dp))
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.split_bill_action_title, card.checkNumber),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        stringResource(R.string.split_bill_action_subtitle),
                        fontSize = 13.sp,
                        color = ui.textSecondary
                    )
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = null)
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, ui.border, RoundedCornerShape(8.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(stringResource(R.string.split_status_paid), color = Color(0xFF27AE60), fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.amount) + ": " + formatMoney(card.amount, currencySymbol))
                card.paymentMethod?.let {
                    Text(stringResource(R.string.payment_method) + ": " + paymentMethodShort(it))
                }
                card.paidAt?.let {
                    Text(stringResource(R.string.time) + ": " + formatSplitTime(it))
                }
                Text(stringResource(R.string.staff) + ": $cashierName")
            }

            ActionChoiceRow(
                selected = mode == SplitBillActionMode.CANCEL_PAYMENT,
                title = stringResource(R.string.split_cancel_payment_title),
                subtitle = stringResource(R.string.split_cancel_payment_desc),
                accent = Color(0xFF27AE60),
                onClick = { mode = SplitBillActionMode.CANCEL_PAYMENT }
            )
            ActionChoiceRow(
                selected = mode == SplitBillActionMode.REFUND,
                title = stringResource(R.string.split_refund_invoice_title),
                subtitle = stringResource(R.string.split_refund_invoice_desc, formatMoney(card.amount, currencySymbol)),
                accent = Color(0xFFE74C3C),
                onClick = { mode = SplitBillActionMode.REFUND }
            )

            if (mode == SplitBillActionMode.REFUND) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFFE74C3C), RoundedCornerShape(8.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = reasons.firstOrNull { it.first == refundReasonId }?.second ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.refund_select_reason)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    reasons.forEach { (id, label) ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { refundReasonId = id }
                        ) {
                            RadioButton(selected = refundReasonId == id, onClick = { refundReasonId = id })
                            Text(label, fontSize = 13.sp)
                        }
                    }
                    OutlinedTextField(
                        value = formatMoney(card.amount, currencySymbol),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.refund_amount)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = refundNote,
                        onValueChange = { if (it.length <= 200) refundNote = it },
                        label = { Text(stringResource(R.string.split_refund_note_optional)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = printRefundReceipt, onCheckedChange = { printRefundReceipt = it })
                        Text(stringResource(R.string.split_print_refund_receipt))
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFF39C12), RoundedCornerShape(8.dp))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(stringResource(R.string.split_bill_action_audit), fontSize = 12.sp, color = ui.textSecondary)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = ui.textSecondary)
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.split_bill_action_pin_hint), fontSize = 12.sp)
                    PinDotsDisplay(pinLength = pin.length)
                    pinError?.let {
                        Text(it, color = Color(0xFFE74C3C), fontSize = 12.sp)
                    }
                }
            }
            PinLoginKeypad(
                onDigit = { digit ->
                    if (pin.length < 6) pin += digit
                },
                onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) },
                onClear = { pin = "" },
                onEnter = {
                    if (pin.length >= 4 && !busy) {
                        onConfirm(mode, pin, refundReasonId, refundNote)
                    }
                },
                enterEnabled = pin.length >= 4 && !busy
            )

            HorizontalDivider()
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), enabled = !busy) {
                    Text(stringResource(R.string.cancel))
                }
                Button(
                    onClick = {
                        if (pin.length >= 4 && !busy) {
                            onConfirm(mode, pin, refundReasonId, refundNote)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = pin.length >= 4 && !busy,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (mode == SplitBillActionMode.REFUND) Color(0xFFE74C3C) else PosColors.Primary
                    )
                ) {
                    Text(
                        if (mode == SplitBillActionMode.REFUND) {
                            stringResource(R.string.split_confirm_refund)
                        } else {
                            stringResource(R.string.split_confirm_cancel_payment)
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionChoiceRow(
    selected: Boolean,
    title: String,
    subtitle: String,
    accent: Color,
    onClick: () -> Unit
) {
    val borderColor = if (selected) accent else posUiColors().border
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(2.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Column {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, fontSize = 12.sp, color = posUiColors().textSecondary)
        }
    }
}

@Composable
private fun paymentMethodShort(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> stringResource(R.string.cash)
    PaymentMethod.CARD -> stringResource(R.string.card)
    PaymentMethod.ADYEN_TERMINAL -> stringResource(R.string.terminal)
    PaymentMethod.TAP_TO_PAY -> stringResource(R.string.tap_to_pay)
    PaymentMethod.PAY_LATER -> stringResource(R.string.pay_later)
    PaymentMethod.INVOICE -> stringResource(R.string.invoice)
    PaymentMethod.GIFT_CARD -> stringResource(R.string.payment_gift_card)
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(java.util.Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatSplitTime(ms: Long): String =
    java.text.SimpleDateFormat("HH:mm, d MMM yyyy", java.util.Locale.getDefault())
        .format(java.util.Date(ms))
