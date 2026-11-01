package com.chaslay.pos.ui.pos



import androidx.compose.foundation.Image

import androidx.compose.foundation.background

import androidx.compose.foundation.layout.Arrangement

import androidx.compose.foundation.layout.Box

import androidx.compose.foundation.layout.BoxWithConstraints

import androidx.compose.foundation.layout.Column

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

import androidx.compose.material.icons.automirrored.filled.ArrowForward

import androidx.compose.material.icons.automirrored.filled.Send

import androidx.compose.material.icons.filled.Check

import androidx.compose.material.icons.filled.CreditCard

import androidx.compose.material.icons.filled.Print

import androidx.compose.material.icons.filled.Receipt

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

import java.util.Locale



private val OrderCompleteCardShape = RoundedCornerShape(24.dp)

private val OrderCompleteSuccessGreen = Color(0xFF1F8F55)

private val OrderCompleteTextPrimary = Color(0xFF121826)

private val OrderCompleteTextSecondary = Color(0xFF556377)



/** Max on-screen QR side within the right column (two-column order-complete layout). */

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

        Card(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .fillMaxHeight(0.85f)
                .padding(16.dp),

            shape = OrderCompleteCardShape,

            colors = CardDefaults.cardColors(containerColor = Color.White),

            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)

        ) {

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp, vertical = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(OrderCompleteSuccessGreen, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    stringResource(R.string.order_complete),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrderCompleteTextPrimary
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState()),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            stringResource(R.string.total_paid),
                            fontSize = 11.sp,
                            color = OrderCompleteTextSecondary,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.8.sp
                        )
                        Text(
                            formatMoney(transaction.total, currencySymbol),
                            fontSize = 32.sp,
                            fontWeight = FontWeight.ExtraBold,
                            fontFamily = FontFamily.Monospace,
                            color = OrderCompleteTextPrimary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        transaction.changeDue?.takeIf { it > 0 }?.let { change ->
                            Text(
                                stringResource(R.string.checkout_change_due, formatMoney(change, currencySymbol)),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF13A99A),
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        Text(
                            com.chaslay.pos.util.OrderNumberFormat.displayForTransaction(transaction),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = OrderCompleteTextPrimary,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                        Text(
                            paymentMethodLabel(transaction.paymentMethod),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = OrderCompleteTextSecondary,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                        if (splitPaymentIndex != null && splitPaymentTotal != null) {
                            Text(
                                stringResource(
                                    R.string.order_complete_split_payment,
                                    splitPaymentIndex,
                                    splitPaymentTotal
                                ),
                                fontSize = 13.sp,
                                color = Color(0xFF16A085),
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        if (showMultiSplitReceiptPrint) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                stringResource(R.string.order_complete_split_receipts_title),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = OrderCompleteTextSecondary,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Start
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            completedSplitOrders.forEachIndexed { index, split ->
                                val splitLabel = split.splitCheckNumber ?: (index + 1)
                                OutlinedButton(
                                    onClick = { onPrintSplitReceipt(split.id) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 2.dp),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Print,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        stringResource(R.string.print_split_n, splitLabel),
                                        fontSize = 13.sp
                                    )
                                }
                            }
                            Button(
                                onClick = onPrintAllSplitReceipts,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF5B21B6))
                            ) {
                                Icon(
                                    Icons.Default.Print,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    stringResource(R.string.print_all_split_receipts),
                                    color = Color.White,
                                    fontSize = 13.sp
                                )
                            }
                        }
                        orderCompleteNotice
                            ?.takeIf { notice ->
                                !notice.contains("printed", ignoreCase = true) &&
                                    !notice.contains("sent", ignoreCase = true)
                            }
                            ?.let { notice ->
                                Spacer(modifier = Modifier.height(10.dp))
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFFFEF2F2)
                                ) {
                                    Text(
                                        notice,
                                        modifier = Modifier.padding(12.dp),
                                        fontSize = 13.sp,
                                        color = Color(0xFFB91C1C),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                    }

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                    ) {
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState()),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            BoxWithConstraints(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.TopCenter
                            ) {
                                val qrDisplaySize = minOf(
                                    maxWidth,
                                    maxHeight.coerceAtLeast(120.dp),
                                    PosReceiptQrMaxDisplayDp
                                )
                                val qrDensity = LocalDensity.current
                                val qrBitmapPx = with(qrDensity) {
                                    (qrDisplaySize * PosReceiptQrBitmapScale).roundToPx().coerceAtLeast(640)
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
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = OrderCompleteTextSecondary,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier
                                                .padding(top = 8.dp)
                                                .width(qrDisplaySize)
                                        )
                                    } else {
                                        Icon(
                                            Icons.Default.Receipt,
                                            contentDescription = null,
                                            tint = OrderCompleteTextSecondary,
                                            modifier = Modifier.size(40.dp)
                                        )
                                    }
                                }
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 64.dp)
                                .padding(top = 8.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            SuccessIconButton(
                                icon = Icons.Default.Print,
                                label = stringResource(R.string.print_receipt),
                                onClick = onPrintReceipt
                            )
                            SuccessIconButton(
                                icon = Icons.AutoMirrored.Filled.Send,
                                label = stringResource(R.string.email_receipt),
                                onClick = onShareEmail
                            )
                            if (showAdyenPaymentReceipt) {
                                SuccessIconButton(
                                    icon = Icons.Default.CreditCard,
                                    label = stringResource(R.string.print_customer_card_receipt),
                                    onClick = onPrintAdyenPaymentReceipt
                                )
                            }
                            if (showAdyenCashierReceipt) {
                                SuccessIconButton(
                                    icon = Icons.Default.Receipt,
                                    label = stringResource(R.string.print_merchant_card_receipt),
                                    onClick = onPrintAdyenCashierReceipt
                                )
                            }
                            SuccessIconButton(
                                icon = Icons.AutoMirrored.Filled.ArrowForward,
                                label = stringResource(R.string.done),
                                primary = true,
                                onClick = onDone
                            )
                        }
                    }
                }
            }

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

            containerColor = if (primary) Color(0xFF5B21B6) else Color(0xFFF5F5F4),

            contentColor = if (primary) Color.White else Color(0xFF44403C)

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

        Card(shape = RoundedCornerShape(20.dp)) {

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

