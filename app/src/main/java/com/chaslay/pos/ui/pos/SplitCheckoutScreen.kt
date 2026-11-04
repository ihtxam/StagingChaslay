package com.chaslay.pos.ui.pos

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.posUiColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SplitCheckoutScreen(
    cart: CartSummary,
    currencySymbol: String,
    totals: SplitCheckoutTotals,
    isModern: Boolean,
    orderTitle: String,
    fulfillmentLabel: String?,
    onBack: () -> Unit,
    onCancelSplit: () -> Unit,
    onEditSplit: () -> Unit,
    onOpenBill: (Int) -> Unit,
    onPaidBillAction: (SplitBillCardUi) -> Unit
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(ui.canvas)
    ) {
        Column(
            modifier = Modifier
                .weight(0.42f)
                .fillMaxHeight()
                .background(ui.surface)
                .padding(PosDimens.Space3)
        ) {
            SplitCheckoutHeader(
                orderTitle = orderTitle,
                fulfillmentLabel = fulfillmentLabel,
                onBack = onBack,
                onCancelSplit = onCancelSplit,
                onEditSplit = onEditSplit
            )
            Text(
                stringResource(R.string.split_checkout_order_lines),
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = ui.textPrimary,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(cart.items, key = { it.id }) { item ->
                    SplitCheckoutLineItem(item, currencySymbol)
                }
            }
            HorizontalDivider(color = ui.border)
            SplitCheckoutOrderSummary(
                orderTotal = totals.orderTotal,
                paidTotal = totals.paidTotal,
                remainingTotal = totals.remainingTotal,
                currencySymbol = currencySymbol
            )
        }

        Column(
            modifier = Modifier
                .weight(0.58f)
                .fillMaxHeight()
                .padding(PosDimens.Space4),
            verticalArrangement = Arrangement.spacedBy(PosDimens.Space3)
        ) {
            Text(
                stringResource(R.string.split_checkout_intro, totals.cards.size),
                fontSize = if (isModern) 18.sp else 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = ui.textPrimary
            )
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                totals.cards.forEach { card ->
                    SplitBillInvoiceCard(
                        card = card,
                        currencySymbol = currencySymbol,
                        isModern = isModern,
                        modifier = Modifier.weight(1f),
                        onOpen = { onOpenBill(card.checkNumber) },
                        onPaidAction = { onPaidBillAction(card) }
                    )
                }
            }
            if (isModern) {
                SplitCheckoutDonutSummary(
                    totals = totals,
                    currencySymbol = currencySymbol
                )
            } else {
                SplitCheckoutSimpleSummary(
                    totals = totals,
                    currencySymbol = currencySymbol
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = Color(0xFF3498DB),
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    stringResource(R.string.split_checkout_move_hint),
                    color = ui.textSecondary,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun SplitCheckoutHeader(
    orderTitle: String,
    fulfillmentLabel: String?,
    onBack: () -> Unit,
    onCancelSplit: () -> Unit,
    onEditSplit: () -> Unit
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(orderTitle, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ui.textPrimary)
            fulfillmentLabel?.let {
                Text(it, fontSize = 12.sp, color = ui.textSecondary)
            }
        }
        OutlinedButton(onClick = onEditSplit) {
            Text(stringResource(R.string.split_bill), fontSize = 12.sp)
        }
        OutlinedButton(
            onClick = onCancelSplit,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE74C3C))
        ) {
            Text(stringResource(R.string.split_checkout_cancel_split), fontSize = 12.sp)
        }
    }
}

@Composable
private fun SplitCheckoutLineItem(item: CartItem, currencySymbol: String) {
    val ui = posUiColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(ui.canvas)
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "${item.quantity}× ${item.productName}",
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                color = ui.textPrimary,
                modifier = Modifier.weight(1f)
            )
            Text(
                formatMoney(item.lineTotal, currencySymbol),
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = ui.textPrimary
            )
        }
    }
}

@Composable
private fun SplitCheckoutOrderSummary(
    orderTotal: Double,
    paidTotal: Double,
    remainingTotal: Double,
    currencySymbol: String
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        SummaryMoneyRow(stringResource(R.string.total), orderTotal, currencySymbol, bold = true)
        if (paidTotal > 0.005) {
            SummaryMoneyRow(
                stringResource(R.string.split_already_paid),
                paidTotal,
                currencySymbol,
                amountColor = Color(0xFF27AE60)
            )
        }
        if (remainingTotal > 0.005) {
            SummaryMoneyRow(
                stringResource(R.string.split_remaining_to_pay),
                remainingTotal,
                currencySymbol
            )
        }
    }
}

@Composable
private fun SummaryMoneyRow(
    label: String,
    amount: Double,
    currencySymbol: String,
    bold: Boolean = false,
    amountColor: Color = Color.Unspecified
) {
    val ui = posUiColors()
    val resolved = if (amountColor == Color.Unspecified) ui.textPrimary else amountColor
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = ui.textSecondary,
            fontSize = 13.sp
        )
        Text(
            formatMoney(amount, currencySymbol),
            fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold,
            color = resolved,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun SplitBillInvoiceCard(
    card: SplitBillCardUi,
    currencySymbol: String,
    isModern: Boolean,
    modifier: Modifier = Modifier,
    onOpen: () -> Unit,
    onPaidAction: () -> Unit
) {
    val ui = posUiColors()
    val paidGreen = Color(0xFFE8F8EF)
    val bg = if (card.isPaid) paidGreen else ui.surface
    Column(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, ui.border, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(R.string.split_invoice_n, card.checkNumber),
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            SplitStatusBadge(isPaid = card.isPaid)
        }
        Text(
            formatMoney(card.amount, currencySymbol),
            fontSize = if (isModern) 22.sp else 18.sp,
            fontWeight = FontWeight.Bold,
            color = PosColors.Primary
        )
        Text(
            stringResource(R.string.split_invoice_meta, card.itemCount),
            fontSize = 12.sp,
            color = ui.textSecondary
        )
        if (card.isPaid) {
            card.paidAt?.let {
                Text(
                    formatSplitTime(it),
                    fontSize = 12.sp,
                    color = ui.textSecondary
                )
            }
            card.paymentMethod?.let { method ->
                Text(
                    paymentMethodLabel(method),
                    fontSize = 12.sp,
                    color = ui.textSecondary
                )
            }
        } else {
            Text(
                stringResource(R.string.split_not_paid),
                fontSize = 12.sp,
                color = ui.textSecondary
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        if (card.isPaid) {
            OutlinedButton(
                onClick = onPaidAction,
                modifier = Modifier.fillMaxWidth(),
                enabled = card.transactionId != null
            ) {
                Text(stringResource(R.string.split_invoice_settled))
            }
        } else {
            Button(
                onClick = onOpen,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary
                )
            ) {
                Text(stringResource(R.string.split_open_invoice))
            }
        }
    }
}

@Composable
private fun SplitStatusBadge(isPaid: Boolean) {
    val bg = if (isPaid) Color(0xFFD5F5E3) else Color(0xFFFDEBD0)
    val fg = if (isPaid) Color(0xFF27AE60) else Color(0xFFE67E22)
    val icon = if (isPaid) Icons.Default.CheckCircle else Icons.Default.Schedule
    val label = if (isPaid) {
        stringResource(R.string.split_status_paid)
    } else {
        stringResource(R.string.split_status_to_pay)
    }
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(14.dp))
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SplitCheckoutDonutSummary(totals: SplitCheckoutTotals, currencySymbol: String) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(ui.surface)
            .border(1.dp, ui.border, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        val paidFraction = if (totals.orderTotal > 0.001) {
            (totals.paidTotal / totals.orderTotal).toFloat().coerceIn(0f, 1f)
        } else {
            0f
        }
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(96.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val stroke = 14.dp.toPx()
                val diameter = size.minDimension - stroke
                val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
                drawArc(
                    color = Color(0xFFE0E0E0),
                    startAngle = -90f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(stroke, cap = StrokeCap.Round)
                )
                drawArc(
                    color = PosColors.Primary,
                    startAngle = -90f,
                    sweepAngle = 360f * paidFraction,
                    useCenter = false,
                    topLeft = topLeft,
                    size = Size(diameter, diameter),
                    style = Stroke(stroke, cap = StrokeCap.Round)
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                stringResource(R.string.split_order_total_label, formatMoney(totals.orderTotal, currencySymbol)),
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            LegendRow(Color(0xFF27AE60), stringResource(R.string.split_already_paid), totals.paidTotal, currencySymbol)
            LegendRow(ui.textSecondary, stringResource(R.string.split_remaining_to_pay), totals.remainingTotal, currencySymbol)
        }
    }
}

@Composable
private fun SplitCheckoutSimpleSummary(totals: SplitCheckoutTotals, currencySymbol: String) {
    SplitCheckoutOrderSummary(
        orderTotal = totals.orderTotal,
        paidTotal = totals.paidTotal,
        remainingTotal = totals.remainingTotal,
        currencySymbol = currencySymbol
    )
}

@Composable
private fun LegendRow(color: Color, label: String, amount: Double, currencySymbol: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Text(label, fontSize = 12.sp, color = posUiColors().textSecondary)
        }
        Text(formatMoney(amount, currencySymbol), fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun paymentMethodLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> stringResource(R.string.cash)
    PaymentMethod.CARD -> stringResource(R.string.card)
    PaymentMethod.ADYEN_TERMINAL -> stringResource(R.string.terminal)
    PaymentMethod.TAP_TO_PAY -> stringResource(R.string.tap_to_pay)
    PaymentMethod.PAY_LATER -> stringResource(R.string.pay_later)
    PaymentMethod.INVOICE -> stringResource(R.string.invoice)
    PaymentMethod.GIFT_CARD -> stringResource(R.string.payment_gift_card)
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatSplitTime(ms: Long): String {
    val fmt = SimpleDateFormat("HH:mm, d MMM yyyy", Locale.getDefault())
    return fmt.format(Date(ms))
}
