package com.chaslay.pos.ui.orderhistory

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.RefundReasonLabels
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.payment.AdyenPaymentReceiptStorage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ChaslayTeal = Color(0xFF0F766E)
private val ChaslayTealLight = Color(0xFFCCFBF1)
private val AccentGreen = Color(0xFF059669)
private val RefundRed = Color(0xFFDC2626)
private val TextPrimary = Color(0xFF111827)
private val TextMuted = Color(0xFF6B7280)
private val CardBg = Color.White
private val PageBg = Color(0xFFF9FAFB)

@Composable
fun OrderDetailDialog(
    order: TransactionEntity,
    items: List<TransactionItemEntity>,
    splitOrders: List<TransactionEntity>,
    splitItemsByOrderId: Map<String, List<TransactionItemEntity>>,
    currencySymbol: String,
    languageCode: String,
    canCancel: Boolean,
    canRefund: Boolean,
    canDelete: Boolean,
    onDismiss: () -> Unit,
    onPrint: () -> Unit,
    onPrintCustomerCard: () -> Unit,
    onPrintMerchantCard: () -> Unit,
    onPrintAllSplits: () -> Unit,
    onPrintSplit: (String) -> Unit,
    onCancel: () -> Unit,
    onRefund: () -> Unit,
    onDelete: () -> Unit
) {
    val context = LocalContext.current
    val isSplit = splitOrders.size > 1
    val hasCustomerCard = AdyenPaymentReceiptStorage.customerReceipt(order) != null
    val hasMerchantCard = AdyenPaymentReceiptStorage.cashierReceipt(order) != null
    val dateFmt = remember { SimpleDateFormat("dd MMM yyyy · HH:mm", Locale.getDefault()) }
    val refundTotal = order.refundAmount.coerceAtLeast(0.0)
    val netTotal = (order.total - refundTotal).coerceAtLeast(0.0)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .widthIn(max = 720.dp),
            shape = RoundedCornerShape(16.dp),
            color = CardBg
        ) {
            Column {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ChaslayTeal)
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                dateFmt.format(Date(order.createdAt)),
                                color = Color.White.copy(alpha = 0.9f),
                                fontSize = 13.sp
                            )
                            Spacer(Modifier.height(4.dp))
                            ChannelBadge(order.serviceType)
                        }
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel), tint = Color.White)
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ChaslayTealLight)
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    StatusPillDetail(orderStatusLabel(order.paymentStatus), statusColor(order.paymentStatus))
                    Text(
                        "#${shortOrderId(order.transactionNumber)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextPrimary
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        SectionTitle(stringResource(R.string.order_detail_products))
                        if (isSplit) {
                            Text(
                                stringResource(R.string.split_order_count, splitOrders.size),
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                            splitOrders.forEachIndexed { index, split ->
                                val splitItems = splitItemsByOrderId[split.id].orEmpty()
                                SplitBillCard(
                                    index = index,
                                    split = split,
                                    items = splitItems,
                                    currencySymbol = currencySymbol,
                                    onPrint = { onPrintSplit(split.id) }
                                )
                            }
                        } else {
                            items.forEach { item ->
                                ProductTimelineRow(item, currencySymbol)
                            }
                        }
                    }

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        SectionTitle(stringResource(R.string.order_detail_bill))
                        if (!isSplit) {
                            BillLine(stringResource(R.string.subtotal), formatMoney(order.subtotal, currencySymbol))
                            if (order.taxTotal > 0) {
                                BillLine(stringResource(R.string.tax), formatMoney(order.taxTotal, currencySymbol))
                            }
                            val orderDiscount = resolveOrderDiscount(order)
                            if (orderDiscount > 0) {
                                BillLine(stringResource(R.string.discount), "-${formatMoney(orderDiscount, currencySymbol)}")
                            }
                            HorizontalDivider(color = Color(0xFFE5E7EB))
                            BillLine(
                                stringResource(R.string.total),
                                formatMoney(order.total, currencySymbol),
                                bold = true
                            )
                            if (refundTotal > 0) {
                                BillLine(
                                    stringResource(R.string.refunded_amount),
                                    "-${formatMoney(refundTotal, currencySymbol)}",
                                    color = RefundRed
                                )
                                BillLine(
                                    stringResource(R.string.net_paid),
                                    formatMoney(netTotal, currencySymbol),
                                    bold = true
                                )
                                order.refundReason?.takeIf { it.isNotBlank() }?.let { reason ->
                                    Text(
                                        "${stringResource(R.string.refund_reason)}: $reason",
                                        fontSize = 12.sp,
                                        color = RefundRed
                                    )
                                }
                            }
                        } else {
                            BillLine(
                                stringResource(R.string.total),
                                formatMoney(splitOrders.sumOf { it.total }, currencySymbol),
                                bold = true
                            )
                        }

                        Spacer(Modifier.height(8.dp))
                        SectionTitle(stringResource(R.string.order_detail_transaction))
                        BillLine(stringResource(R.string.payment_method), paymentLabel(order.paymentMethod))
                        BillLine(stringResource(R.string.staff), order.userName)
                        if (hasCustomerCard || hasMerchantCard) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (hasCustomerCard) {
                                    OutlinedButton(onClick = onPrintCustomerCard, modifier = Modifier.weight(1f)) {
                                        Icon(Icons.Default.CreditCard, null, Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(stringResource(R.string.print_customer_card_receipt), fontSize = 10.sp, maxLines = 1)
                                    }
                                }
                                if (hasMerchantCard) {
                                    OutlinedButton(onClick = onPrintMerchantCard, modifier = Modifier.weight(1f)) {
                                        Icon(Icons.Default.Receipt, null, Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(stringResource(R.string.print_merchant_card_receipt), fontSize = 10.sp, maxLines = 1)
                                    }
                                }
                            }
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFFE5E7EB))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PageBg)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = {
                            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cm.setPrimaryClip(ClipData.newPlainText("order_id", order.transactionNumber))
                        }
                    ) {
                        Icon(Icons.Default.ContentCopy, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.copy_order_id), fontSize = 12.sp)
                    }
                    if (isSplit) {
                        OutlinedButton(onClick = onPrintAllSplits, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Default.Print, null, Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(stringResource(R.string.print_receipt))
                        }
                    } else {
                        Button(
                            onClick = onPrint,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = ChaslayTeal)
                        ) {
                            Icon(Icons.Default.Print, null, Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.print_receipt))
                        }
                    }
                    if (canRefund) {
                        Button(
                            onClick = onRefund,
                            colors = ButtonDefaults.buttonColors(containerColor = RefundRed)
                        ) {
                            Text(stringResource(R.string.refund_order))
                        }
                    }
                }

                if (canCancel || canDelete) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 0.dp)
                            .padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.End
                    ) {
                        if (canCancel) {
                            TextButton(onClick = onCancel) {
                                Text(stringResource(R.string.cancel_order), color = TextMuted)
                            }
                        }
                        if (canDelete) {
                            TextButton(onClick = onDelete) {
                                Text(stringResource(R.string.delete_order_permanently), color = RefundRed)
                            }
                        }
                    }
                }
            }
        }
    }
}

private enum class RefundWizardStep { AMOUNT, REASON, COMPLETED }

private enum class RefundAmountTab(val index: Int) {
    ENTIRE_BILL(0), BY_ARTICLE(1), CUSTOM_AMOUNT(2)
}

@Composable
fun RefundWizardDialog(
    maxAmount: Double,
    paymentMethodLabel: String,
    items: List<TransactionItemEntity>,
    currencySymbol: String,
    languageCode: String,
    onDismiss: () -> Unit,
    onConfirm: (
        Double,
        Boolean,
        List<Pair<Long, Int>>,
        String?,
        String,
        String
    ) -> Unit,
    onPrintReceipt: () -> Unit
) {
    var step by remember { mutableStateOf(RefundWizardStep.AMOUNT) }
    var amountTab by remember { mutableIntStateOf(0) }
    var amountText by remember { mutableStateOf("") }
    var selectedReasonId by remember { mutableStateOf(RefundReasonLabels.options.first().id) }
    var customReason by remember { mutableStateOf("") }

    val refundableItems = items.mapNotNull { item ->
        val left = (item.quantity - item.refundedQuantity).coerceAtLeast(0)
        if (left <= 0) null else item to left
    }
    val selectedQty = remember(refundableItems) {
        mutableStateMapOf<Long, Int>().apply {
            refundableItems.forEach { (item, _) -> this[item.id] = 0 }
        }
    }

    val reasonOptions = remember(languageCode) {
        RefundReasonLabels.localizedOptions(languageCode)
    }

    val previewAmount = when (RefundAmountTab.entries.find { it.index == amountTab }) {
        RefundAmountTab.ENTIRE_BILL -> maxAmount
        RefundAmountTab.CUSTOM_AMOUNT -> (amountText.toDoubleOrNull() ?: 0.0).coerceIn(0.0, maxAmount)
        RefundAmountTab.BY_ARTICLE -> {
            refundableItems.sumOf { (item, left) ->
                val qty = (selectedQty[item.id] ?: 0).coerceIn(0, left)
                val unit = if (item.quantity > 0) item.lineTotal / item.quantity else 0.0
                unit * qty
            }
        }
        null -> 0.0
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.47f)
                .widthIn(max = 300.dp),
            shape = RoundedCornerShape(12.dp),
            color = CardBg
        ) {
            Column(modifier = Modifier.padding(0.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ChaslayTeal)
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            when (step) {
                                RefundWizardStep.AMOUNT -> stringResource(R.string.refund_order)
                                RefundWizardStep.REASON -> stringResource(R.string.refund_select_reason)
                                RefundWizardStep.COMPLETED -> stringResource(R.string.refund_completed)
                            },
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                        }
                    }
                }

                when (step) {
                    RefundWizardStep.AMOUNT -> {
                        TabRow(
                            selectedTabIndex = amountTab,
                            containerColor = PageBg,
                            contentColor = ChaslayTeal,
                            indicator = { tabPositions ->
                                if (amountTab < tabPositions.size) {
                                    TabRowDefaults.SecondaryIndicator(
                                        modifier = Modifier.tabIndicatorOffset(tabPositions[amountTab]),
                                        color = ChaslayTeal
                                    )
                                }
                            }
                        ) {
                            Tab(
                                selected = amountTab == 0,
                                onClick = { amountTab = 0 },
                                text = { Text(stringResource(R.string.refund_entire_bill), fontSize = 11.sp) }
                            )
                            Tab(
                                selected = amountTab == 1,
                                onClick = { amountTab = 1 },
                                enabled = refundableItems.isNotEmpty(),
                                text = { Text(stringResource(R.string.refund_by_item), fontSize = 11.sp) }
                            )
                            Tab(
                                selected = amountTab == 2,
                                onClick = { amountTab = 2 },
                                text = { Text(stringResource(R.string.refund_custom_amount), fontSize = 11.sp) }
                            )
                        }

                        Column(
                            modifier = Modifier
                                .padding(12.dp)
                                .verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            when (RefundAmountTab.entries.find { it.index == amountTab }) {
                                RefundAmountTab.ENTIRE_BILL -> {
                                    Text(
                                        stringResource(R.string.refund_entire_bill_desc),
                                        color = TextMuted,
                                        fontSize = 13.sp
                                    )
                                    BillLine(stringResource(R.string.payment_method), paymentMethodLabel)
                                    BillLine(
                                        stringResource(R.string.refund_paid_amount),
                                        formatMoney(maxAmount, currencySymbol),
                                        bold = true
                                    )
                                }
                                RefundAmountTab.BY_ARTICLE -> {
                                    refundableItems.forEach { (item, left) ->
                                        val qty = selectedQty[item.id] ?: 0
                                        val checked = qty > 0
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    selectedQty[item.id] = if (checked) 0 else 1
                                                }
                                                .padding(vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Checkbox(
                                                checked = checked,
                                                onCheckedChange = { on ->
                                                    selectedQty[item.id] = if (on) 1 else 0
                                                }
                                            )
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(item.productName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                                Text(
                                                    formatMoney(item.lineTotal, currencySymbol),
                                                    fontSize = 12.sp,
                                                    color = TextMuted
                                                )
                                            }
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                TextButton(onClick = {
                                                    selectedQty[item.id] = (qty - 1).coerceAtLeast(0)
                                                }) { Text("−", fontSize = 18.sp) }
                                                Text(qty.toString(), modifier = Modifier.padding(horizontal = 8.dp))
                                                TextButton(onClick = {
                                                    selectedQty[item.id] = (qty + 1).coerceAtMost(left)
                                                }) { Text("+", fontSize = 18.sp) }
                                            }
                                        }
                                    }
                                }
                                RefundAmountTab.CUSTOM_AMOUNT -> {
                                    Text(
                                        stringResource(R.string.refund_custom_amount_desc, formatMoney(maxAmount, currencySymbol)),
                                        color = TextMuted,
                                        fontSize = 13.sp
                                    )
                                    OutlinedTextField(
                                        value = amountText,
                                        onValueChange = { amountText = it },
                                        label = { Text(stringResource(R.string.refund_amount)) },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                                null -> Unit
                            }

                            Surface(
                                color = ChaslayTealLight,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(stringResource(R.string.refund_total), fontWeight = FontWeight.SemiBold)
                                    Text(
                                        formatMoney(previewAmount, currencySymbol),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        color = ChaslayTeal
                                    )
                                }
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                                Text(stringResource(R.string.cancel))
                            }
                            Button(
                                onClick = { step = RefundWizardStep.REASON },
                                enabled = previewAmount > 0.001,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = ChaslayTeal)
                            ) {
                                Text(stringResource(R.string.next))
                            }
                        }
                    }

                    RefundWizardStep.REASON -> {
                        Column(
                            modifier = Modifier
                                .padding(20.dp)
                                .verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                stringResource(R.string.refund_select_reason),
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                            reasonOptions.forEach { (id, label) ->
                                val selected = selectedReasonId == id
                                Surface(
                                    onClick = { selectedReasonId = id },
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (selected) ChaslayTealLight else PageBg,
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (selected) ChaslayTeal else Color(0xFFE5E7EB)
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        label,
                                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (selected) ChaslayTeal else TextPrimary
                                    )
                                }
                            }
                            if (selectedReasonId == "other") {
                                OutlinedTextField(
                                    value = customReason,
                                    onValueChange = { customReason = it },
                                    label = { Text(stringResource(R.string.refund_reason_other_hint)) },
                                    modifier = Modifier.fillMaxWidth(),
                                    minLines = 2
                                )
                            }
                            BillLine(
                                stringResource(R.string.refund_total),
                                formatMoney(previewAmount, currencySymbol),
                                bold = true
                            )
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(onClick = { step = RefundWizardStep.AMOUNT }, modifier = Modifier.weight(1f)) {
                                Text(stringResource(R.string.back))
                            }
                            Button(
                                onClick = {
                                    val reason = RefundReasonLabels.resolveReason(
                                        languageCode,
                                        selectedReasonId,
                                        customReason
                                    ).takeIf { it.isNotBlank() }
                                    when (RefundAmountTab.entries.find { it.index == amountTab }) {
                                        RefundAmountTab.ENTIRE_BILL ->
                                            onConfirm(maxAmount, true, emptyList(), reason, "referenced", "cash")
                                        RefundAmountTab.BY_ARTICLE -> {
                                            val picks = selectedQty.mapNotNull { (id, qty) ->
                                                if (qty > 0) id to qty else null
                                            }
                                            onConfirm(0.0, false, picks, reason, "referenced", "cash")
                                        }
                                        RefundAmountTab.CUSTOM_AMOUNT ->
                                            onConfirm(
                                                amountText.toDoubleOrNull() ?: 0.0,
                                                false,
                                                emptyList(),
                                                reason,
                                                "referenced",
                                                "cash"
                                            )
                                        null -> Unit
                                    }
                                    step = RefundWizardStep.COMPLETED
                                },
                                enabled = selectedReasonId != "other" || customReason.isNotBlank(),
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = ChaslayTeal)
                            ) {
                                Text(stringResource(R.string.confirm_refund))
                            }
                        }
                    }

                    RefundWizardStep.COMPLETED -> {
                        Column(
                            modifier = Modifier
                                .padding(32.dp)
                                .fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = AccentGreen,
                                modifier = Modifier.size(56.dp)
                            )
                            Text(
                                stringResource(R.string.refund_completed),
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                            Text(
                                formatMoney(previewAmount, currencySymbol),
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold,
                                color = ChaslayTeal
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedButton(
                                    onClick = onDismiss,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(stringResource(R.string.refund_no_print))
                                }
                                Button(
                                    onClick = {
                                        onPrintReceipt()
                                        onDismiss()
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.buttonColors(containerColor = ChaslayTeal)
                                ) {
                                    Icon(Icons.Default.Print, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(stringResource(R.string.print_receipt))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextMuted, letterSpacing = 0.5.sp)
}

@Composable
private fun BillLine(text: String, value: String, bold: Boolean = false, color: Color = TextPrimary) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text, fontSize = 13.sp, color = TextMuted)
        Text(
            value,
            fontSize = 13.sp,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = color
        )
    }
}

@Composable
private fun ProductTimelineRow(item: TransactionItemEntity, currencySymbol: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(ChaslayTeal, RoundedCornerShape(4.dp))
                .align(Alignment.Top)
                .padding(top = 6.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.quantity}× ${item.productName}",
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(formatMoney(item.lineTotal, currencySymbol), fontSize = 12.sp, color = TextMuted)
            if (item.refundedQuantity > 0) {
                Text(
                    stringResource(R.string.refund_item_qty, item.refundedQuantity),
                    fontSize = 11.sp,
                    color = RefundRed
                )
            }
        }
    }
}

@Composable
private fun SplitBillCard(
    index: Int,
    split: TransactionEntity,
    items: List<TransactionItemEntity>,
    currencySymbol: String,
    onPrint: () -> Unit
) {
    Surface(
        color = PageBg,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    split.splitCheckNumber?.let { stringResource(R.string.split_bill_n, it) }
                        ?: stringResource(R.string.split_bill_n, index + 1),
                    fontWeight = FontWeight.Bold
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(formatMoney(split.total, currencySymbol), fontWeight = FontWeight.Bold)
                    IconButton(onClick = onPrint, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Print, null, Modifier.size(18.dp))
                    }
                }
            }
            items.forEach { item ->
                Text("${item.quantity}× ${item.productName}", fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ChannelBadge(serviceType: ServiceType?) {
    val (label, color) = when (serviceType) {
        ServiceType.DINE_IN -> stringResource(R.string.dine_in) to Color(0xFF92400E)
        ServiceType.TAKEAWAY -> stringResource(R.string.takeaway) to Color(0xFF7C3AED)
        else -> stringResource(R.string.walk_in) to Color(0xFF0891B2)
    }
    Surface(color = color.copy(alpha = 0.25f), shape = RoundedCornerShape(6.dp)) {
        Text(
            label.uppercase(),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun StatusPillDetail(text: String, color: Color) {
    Surface(color = color.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

private fun orderStatusLabel(status: PaymentStatus): String = when (status) {
    PaymentStatus.COMPLETED -> "Completed"
    PaymentStatus.REFUNDED -> "Refunded"
    PaymentStatus.PARTIALLY_REFUNDED -> "Partially refunded"
    PaymentStatus.CANCELLED -> "Cancelled"
    else -> status.name.replace('_', ' ')
}

private fun shortOrderId(number: String): String =
    com.chaslay.pos.util.OrderNumberFormat.guestOrderNumber(number).ifBlank {
        number.removePrefix("TX-")
    }

private fun resolveOrderDiscount(order: TransactionEntity): Double {
    if (order.discountAmount > 0.0) return order.discountAmount
    if (order.discountPercent > 0.0) {
        return order.subtotal * (order.discountPercent / 100.0)
    }
    return 0.0
}

private fun paymentLabel(method: com.chaslay.pos.domain.model.PaymentMethod): String = when (method) {
    com.chaslay.pos.domain.model.PaymentMethod.CASH -> "Cash"
    com.chaslay.pos.domain.model.PaymentMethod.CARD -> "Card"
    com.chaslay.pos.domain.model.PaymentMethod.ADYEN_TERMINAL -> "Terminal"
    com.chaslay.pos.domain.model.PaymentMethod.TAP_TO_PAY -> "Tap"
    com.chaslay.pos.domain.model.PaymentMethod.PAY_LATER -> "Pay Later"
    com.chaslay.pos.domain.model.PaymentMethod.INVOICE -> "Invoice"
    com.chaslay.pos.domain.model.PaymentMethod.GIFT_CARD -> "Gift card"
}

private fun statusColor(status: PaymentStatus): Color = when (status) {
    PaymentStatus.COMPLETED -> AccentGreen
    PaymentStatus.CANCELLED -> RefundRed
    PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED -> Color(0xFFD97706)
    else -> TextMuted
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
