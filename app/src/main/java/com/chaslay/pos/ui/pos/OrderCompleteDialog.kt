package com.chaslay.pos.ui.pos
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Print
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.receipt.ReceiptQrGenerator
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import java.util.Locale

/** Max on-screen QR side within the order-complete dialog (half of register receipt preview). */
private val OrderCompleteQrMaxDisplayDp = 170.dp

internal val PosReceiptQrMaxDisplayDp = 340.dp

internal const val PosReceiptQrBitmapScale = 2f

@Composable
fun OrderCompleteDialog(
    transaction: TransactionEntity,
    currencySymbol: String,
    splitPaymentIndex: Int? = null,
    splitPaymentTotal: Int? = null,
    completedSplitOrders: List<TransactionEntity> = emptyList(),
    receiptPublicUrl: String? = null,
    orderCompleteNotice: String? = null,
    showAdyenPaymentReceipt: Boolean = false,
    showAdyenCashierReceipt: Boolean = false,
    isPrintingReceipt: Boolean = false,
    onPrintReceipt: () -> Unit,
    onPrintSplitReceipt: (String) -> Unit = {},
    onPrintAllSplitReceipts: () -> Unit = {},
    onPrintAdyenPaymentReceipt: () -> Unit = {},
    onPrintAdyenCashierReceipt: () -> Unit = {},
    onShareEmail: () -> Unit = {},
    onDone: () -> Unit
) {
    val digitalUrl = receiptPublicUrl?.takeIf { it.isNotBlank() }
        ?: transaction.receiptUrl?.takeIf { it.isNotBlank() }
    val qrGenerator = remember { ReceiptQrGenerator() }
    val showMultiSplitReceiptPrint = completedSplitOrders.size > 1 &&
        (splitPaymentIndex == null || splitPaymentTotal == null || splitPaymentIndex >= splitPaymentTotal)

    Dialog(
        onDismissRequest = onDone,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth(0.68f)
                .fillMaxHeight(0.92f)
                .padding(vertical = 4.dp, horizontal = 8.dp)
        ) {
            val dialogHeight = minOf(maxHeight, 620.dp)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(dialogHeight),
                shape = PosShapes.Dialog,
                colors = CardDefaults.cardColors(containerColor = posUiColors().surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(posUiColors().primarySubtle)
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(PosColors.Success, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            stringResource(R.string.order_complete),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = posUiColors().textPrimary
                        )
                        Text(
                            stringResource(R.string.order_complete_subtitle),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = posUiColors().textSecondary,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }

                    val bodyScroll = rememberScrollState()
                    val ui = posUiColors()
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .verticalScroll(bodyScroll)
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                        val orderNumber = com.chaslay.pos.util.OrderNumberFormat.displayForTransaction(transaction)
                        val paymentLabel = paymentMethodLabel(transaction.paymentMethod)
                        Column(
                            modifier = Modifier
                                .weight(1.05f),
                            horizontalAlignment = Alignment.Start
                        ) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = PosShapes.Large,
                            color = posUiColors().surfaceMuted
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    stringResource(R.string.total_paid),
                                    fontSize = 10.sp,
                                    color = posUiColors().textSecondary,
                                    fontWeight = FontWeight.SemiBold,
                                    letterSpacing = 0.8.sp
                                )
                                Text(
                                    formatMoney(transaction.total, currencySymbol),
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace,
                                    color = posUiColors().textPrimary,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                                transaction.changeDue?.takeIf { it > 0 }?.let { change ->
                                    Text(
                                        stringResource(
                                            R.string.checkout_change_due,
                                            formatMoney(change, currencySymbol)
                                        ),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = PosColors.Warning,
                                        modifier = Modifier.padding(top = 6.dp)
                                    )
                                }
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = 12.dp),
                                    color = posUiColors().border
                                )
                                OrderCompleteDetailRow(
                                    iconContent = {
                                        Text(
                                            "#",
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = posUiColors().textSecondary
                                        )
                                    },
                                    value = orderNumber,
                                    caption = stringResource(R.string.order_number)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                OrderCompleteDetailRow(
                                    iconContent = {
                                        PaymentMethodIcon(transaction.paymentMethod)
                                    },
                                    value = paymentLabel,
                                    caption = stringResource(R.string.order_complete_payment_method)
                                )
                            }
                        }
                        if (splitPaymentIndex != null && splitPaymentTotal != null) {
                            Text(
                                stringResource(
                                    R.string.order_complete_split_payment,
                                    splitPaymentIndex,
                                    splitPaymentTotal
                                ),
                                fontSize = 12.sp,
                                color = PosColors.Primary,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 10.dp)
                            )
                        }
                        if (showMultiSplitReceiptPrint) {
                            Spacer(modifier = Modifier.height(8.dp))
                            OrderCompleteSplitReceiptBadges(
                                completedSplitOrders = completedSplitOrders,
                                currencySymbol = currencySymbol,
                                onPrintSplitReceipt = onPrintSplitReceipt,
                                onPrintAllSplitReceipts = onPrintAllSplitReceipts,
                            )
                        }
                        if (showAdyenPaymentReceipt || showAdyenCashierReceipt) {
                            Spacer(modifier = Modifier.height(8.dp))
                            if (showAdyenPaymentReceipt) {
                                TextButton(onClick = onPrintAdyenPaymentReceipt) {
                                    Text(stringResource(R.string.print_customer_card_receipt), fontSize = 11.sp)
                                }
                            }
                            if (showAdyenCashierReceipt) {
                                TextButton(onClick = onPrintAdyenCashierReceipt) {
                                    Text(stringResource(R.string.print_merchant_card_receipt), fontSize = 11.sp)
                                }
                            }
                        }
                        orderCompleteNotice
                            ?.takeIf { notice ->
                                !notice.contains("printed", ignoreCase = true) &&
                                    !notice.contains("sent", ignoreCase = true)
                            }
                            ?.let { notice ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp),
                                    color = posUiColors().dangerSubtle
                                ) {
                                    Text(
                                        notice,
                                        modifier = Modifier.padding(10.dp),
                                        fontSize = 12.sp,
                                        color = PosColors.Danger,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                    }

                        if (digitalUrl != null) {
                            Column(
                                modifier = Modifier.weight(0.95f),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Top
                            ) {
                            BoxWithConstraints(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.TopCenter
                            ) {
                                val qrDisplaySize = minOf(maxWidth, OrderCompleteQrMaxDisplayDp)
                                val qrDensity = LocalDensity.current
                                val qrBitmapPx = with(qrDensity) {
                                    (qrDisplaySize * PosReceiptQrBitmapScale).roundToPx().coerceAtLeast(320)
                                }
                                val qrBitmap = remember(digitalUrl, qrBitmapPx) {
                                    digitalUrl?.let { qrGenerator.generateQrBitmap(it, qrBitmapPx) }
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    if (qrBitmap != null) {
                                        Image(
                                            bitmap = qrBitmap.asImageBitmap(),
                                            contentDescription = stringResource(R.string.digital_receipt),
                                            modifier = Modifier
                                                .size(qrDisplaySize)
                                                .clip(RoundedCornerShape(8.dp))
                                        )
                                        Text(
                                            stringResource(R.string.scan_digital_receipt),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = posUiColors().textSecondary,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier
                                                .padding(top = 8.dp)
                                                .width(qrDisplaySize + 24.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                    }
                    }

                    HorizontalDivider(color = ui.border)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ui.surface)
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = onDone,
                            modifier = Modifier.weight(0.85f),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp)
                        ) {
                            Text(
                                stringResource(R.string.cancel),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = ui.textSecondary
                            )
                        }
                        OutlinedButton(
                            onClick = onPrintReceipt,
                            enabled = !isPrintingReceipt,
                            modifier = Modifier.weight(1.15f),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                        ) {
                            Icon(
                                Icons.Default.Print,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = ui.textPrimary
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                if (isPrintingReceipt) {
                                    stringResource(R.string.print_receipt_in_progress)
                                } else {
                                    stringResource(R.string.print_receipt)
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = ui.textPrimary,
                                maxLines = 1
                            )
                        }
                        Button(
                            onClick = onDone,
                            modifier = Modifier.weight(0.85f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                        ) {
                            Text(
                                stringResource(R.string.ok),
                                color = PosColors.TextOnPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

private const val OrderCompleteSplitReceiptColumns = 3

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OrderCompleteSplitReceiptBadges(
    completedSplitOrders: List<TransactionEntity>,
    currencySymbol: String,
    onPrintSplitReceipt: (String) -> Unit,
    onPrintAllSplitReceipts: () -> Unit,
) {
    val ui = posUiColors()
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.order_complete_split_receipts_title),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = ui.textSecondary,
        )
        Spacer(modifier = Modifier.height(6.dp))
        completedSplitOrders.chunked(OrderCompleteSplitReceiptColumns).forEach { rowSplits ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                rowSplits.forEach { split ->
                    val globalIndex = completedSplitOrders.indexOf(split)
                    val splitLabel = split.splitCheckNumber ?: (globalIndex + 1)
                    OrderCompleteSplitReceiptBadge(
                        splitLabel = splitLabel,
                        amountLabel = formatMoney(split.total, currencySymbol),
                        modifier = Modifier.weight(1f),
                        onClick = { onPrintSplitReceipt(split.id) },
                    )
                }
                repeat(OrderCompleteSplitReceiptColumns - rowSplits.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Surface(
                onClick = onPrintAllSplitReceipts,
                shape = PosShapes.Pill,
                color = PosColors.Primary,
                modifier = Modifier.heightIn(min = 32.dp),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Default.Print,
                        contentDescription = null,
                        tint = PosColors.TextOnPrimary,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        stringResource(R.string.print_all_split_receipts),
                        color = PosColors.TextOnPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun OrderCompleteSplitReceiptBadge(
    splitLabel: Int,
    amountLabel: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val ui = posUiColors()
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(ui.primarySubtle)
            .border(1.dp, ui.primaryBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Icon(
                Icons.Default.Print,
                contentDescription = null,
                tint = PosColors.Primary,
                modifier = Modifier.size(12.dp),
            )
            Text(
                stringResource(R.string.print_split_n, splitLabel),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = ui.textSecondary,
                maxLines = 1,
            )
        }
        Text(
            amountLabel,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = ui.textPrimary,
            maxLines = 1,
        )
    }
}

@Composable
private fun OrderCompleteDetailRow(
    iconContent: @Composable () -> Unit,
    value: String,
    caption: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(posUiColors().surface),
            contentAlignment = Alignment.Center
        ) {
            iconContent()
        }
        Column {
            Text(
                value,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = posUiColors().textPrimary
            )
            Text(
                caption,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = posUiColors().textSecondary
            )
        }
    }
}

@Composable
private fun SuccessIconButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    primary: Boolean = false
) {
    Button(
        onClick = onClick,
        modifier = Modifier.size(64.dp),
        shape = RoundedCornerShape(16.dp),
        contentPadding = PaddingValues(0.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (primary) PosColors.Primary else posUiColors().surfaceMuted,
            contentColor = if (primary) PosColors.TextOnPrimary else posUiColors().textPrimary
        )
    ) {
        Icon(icon, contentDescription = label, modifier = Modifier.size(26.dp))
    }
}

@Composable
fun ReceiptEmailDialog(
    isSending: Boolean,
    errorMessage: String? = null,
    onDismiss: () -> Unit,
    onSend: (email: String) -> Unit
) {
    var email by remember { mutableStateOf("") }

    Dialog(onDismissRequest = { if (!isSending) onDismiss() }) {
        Card(shape = PosShapes.ExtraLarge) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    stringResource(R.string.email_receipt_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    stringResource(R.string.email_receipt_hint),
                    fontSize = 13.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.trim() },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.customer_email)) },
                    singleLine = true,
                    enabled = !isSending,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Email
                    )
                )
                errorMessage?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = Color(0xFFB91C1C), fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSending) {
                        Text(stringResource(R.string.cancel))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSend(email) },
                        enabled = !isSending && email.contains("@") && email.contains(".")
                    ) {
                        Text(if (isSending) stringResource(R.string.sending) else stringResource(R.string.send))
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentMethodIcon(method: PaymentMethod) {
    val icon = when (method) {
        PaymentMethod.CASH -> Icons.Default.AccountBalanceWallet
        PaymentMethod.CARD, PaymentMethod.TAP_TO_PAY, PaymentMethod.ADYEN_TERMINAL -> Icons.Default.CreditCard
        else -> Icons.Default.CreditCard
    }
    Icon(
        icon,
        contentDescription = null,
        tint = PosColors.Primary,
        modifier = Modifier.size(20.dp)
    )
}

@Composable
private fun paymentMethodLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> stringResource(R.string.cash)
    PaymentMethod.CARD -> stringResource(R.string.card)
    PaymentMethod.TAP_TO_PAY -> stringResource(R.string.tap_to_pay_method)
    PaymentMethod.ADYEN_TERMINAL -> stringResource(R.string.adyen_terminal)
    PaymentMethod.PAY_LATER -> stringResource(R.string.pay_later)
    PaymentMethod.INVOICE -> stringResource(R.string.invoice)
    PaymentMethod.GIFT_CARD -> stringResource(R.string.payment_gift_card)
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
