package com.chaslay.pos.ui.orderhistory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.payment.AdyenPaymentReceiptStorage
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val PageBg = Color(0xFFF3F4F6)
private val CardBg = Color.White
private val HeaderBg = Color(0xFFFAFAFA)
private val TextPrimary = Color(0xFF111827)
private val TextMuted = Color(0xFF6B7280)
private val AccentGreen = Color(0xFF059669)
private val ChaslayTeal = Color(0xFF0F766E)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: OrderHistoryViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showSearchDialog by remember { mutableStateOf(false) }

    if (showSearchDialog) {
        var searchText by remember(state.searchQuery) { mutableStateOf(state.searchQuery) }
        AlertDialog(
            onDismissRequest = { showSearchDialog = false },
            title = { Text("Search orders") },
            text = {
                OutlinedTextField(
                    value = searchText,
                    onValueChange = { searchText = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("ORDER ID...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.setSearchQuery(searchText)
                    showSearchDialog = false
                }) { Text(stringResource(R.string.confirm)) }
            },
            dismissButton = {
                TextButton(onClick = {
                    searchText = ""
                    viewModel.setSearchQuery("")
                    showSearchDialog = false
                }) { Text("Clear") }
            }
        )
    }

    state.message?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text(stringResource(R.string.confirm)) } },
            title = { Text(stringResource(R.string.order_history)) },
            text = { Text(message) }
        )
    }

    state.selectedOrder?.let { order ->
        OrderDetailDialog(
            order = order,
            items = state.selectedItems,
            splitOrders = state.splitOrders,
            splitItemsByOrderId = state.splitItemsByOrderId,
            currencySymbol = state.currencySymbol,
            languageCode = state.languageCode,
            canCancel = order.paymentStatus == PaymentStatus.COMPLETED,
            canRefund = order.paymentStatus == PaymentStatus.COMPLETED ||
                order.paymentStatus == PaymentStatus.PARTIALLY_REFUNDED,
            canDelete = state.deleteModeUnlocked && state.isAdminUser,
            onDismiss = viewModel::closeOrderDetail,
            onPrint = viewModel::printSelectedOrder,
            onPrintCustomerCard = viewModel::printAdyenCustomerReceiptForSelected,
            onPrintMerchantCard = {},
            onPrintAllSplits = viewModel::printAllSplitOrders,
            onPrintSplit = viewModel::printSplitOrder,
            onCancel = viewModel::showCancelDialog,
            onRefund = viewModel::showRefundDialog,
            onDelete = { viewModel.requestDeleteOrder(order) }
        )
    }

    if (state.showCancelDialog) {
        CancelOrderDialog(
            reasons = state.cancelReasons,
            onDismiss = viewModel::dismissCancelDialog,
            onConfirm = viewModel::cancelSelectedOrder
        )
    }

    if (state.showRefundDialog) {
        val order = state.selectedOrder
        RefundWizardDialog(
            maxAmount = ((order?.total ?: 0.0) - (order?.refundAmount ?: 0.0)).coerceAtLeast(0.0),
            paymentMethodLabel = order?.paymentMethod?.name?.replace('_', ' ') ?: "",
            items = state.selectedItems,
            currencySymbol = state.currencySymbol,
            languageCode = state.languageCode,
            onDismiss = viewModel::dismissRefundDialog,
            onConfirm = { amount, full, itemRefunds, reason, refundKind, goodwillMethod ->
                viewModel.refundSelectedOrder(
                    amount,
                    full,
                    itemRefunds,
                    reason,
                    refundKind,
                    goodwillMethod
                )
            },
            onPrintReceipt = viewModel::printSelectedOrder
        )
    }

    if (state.showDeleteDialog && state.pendingDeleteOrder != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissDeleteDialog,
            title = { Text(stringResource(R.string.delete_order_permanently)) },
            text = {
                Text(
                    stringResource(
                        R.string.delete_order_confirm,
                        shortOrderId(state.pendingDeleteOrder!!.transactionNumber)
                    )
                )
            },
            confirmButton = {
                Button(onClick = viewModel::confirmDeleteOrder) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDeleteDialog) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (state.showBulkDeleteDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissBulkDeleteDialog,
            title = { Text(stringResource(R.string.delete_orders_in_range)) },
            text = {
                Text(
                    stringResource(
                        R.string.delete_orders_in_range_confirm,
                        state.bulkDeleteCount,
                        state.dateRangeLabel
                    )
                )
            },
            confirmButton = {
                Button(onClick = viewModel::confirmBulkDelete) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissBulkDeleteDialog) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (embedded) {
        LaunchedEffect(Unit) { viewModel.refresh() }
        OrderHistoryContent(
            modifier = Modifier.fillMaxSize(),
            state = state,
            viewModel = viewModel,
            showRefresh = true
        )
    } else {
        Scaffold(
            containerColor = PageBg,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(stringResource(R.string.order_records), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(
                                stringResource(R.string.order_history),
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    },
                    actions = {
                        IconButton(onClick = { showSearchDialog = true }) {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = "Search",
                                tint = if (state.searchQuery.isNotBlank()) AccentGreen else Color.Unspecified
                            )
                        }
                        IconButton(onClick = viewModel::refresh) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                        }
                    }
                )
            }
        ) { padding ->
            OrderHistoryContent(
                modifier = Modifier.padding(padding),
                state = state,
                viewModel = viewModel,
                showRefresh = false
            )
        }
    }
}

@Composable
private fun OrderHistoryContent(
    modifier: Modifier = Modifier,
    state: OrderHistoryUiState,
    viewModel: OrderHistoryViewModel,
    showRefresh: Boolean = false
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        if (showRefresh) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = viewModel::refresh) {
                    Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
                }
            }
        }
            RecordsChannelTabs(
                selected = state.channelTab,
                onSelect = viewModel::setChannelTab
            )
            Spacer(modifier = Modifier.height(8.dp))
            RecordsFilterBar(
                state = state,
                onDate = viewModel::setDateFilter,
                onStatus = viewModel::setStatusFilter,
                onType = viewModel::setServiceFilter,
                onPayment = viewModel::setPaymentFilter
            )

            if (state.deleteModeUnlocked && state.isAdminUser) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = viewModel::requestBulkDelete) {
                        Text(
                            stringResource(R.string.delete_orders_in_range),
                            color = Color(0xFFDC2626),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                modifier = Modifier.fillMaxSize(),
                shape = RoundedCornerShape(12.dp),
                color = CardBg,
                shadowElevation = 1.dp
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    RecordsTableHeader(onAdminUnlockTap = viewModel::onAdminUnlockTap)
                    HorizontalDivider(color = Color(0xFFE5E7EB))
                    if (state.orders.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(stringResource(R.string.no_orders_found), color = TextMuted)
                        }
                    } else {
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            itemsIndexed(state.orders, key = { _, order -> order.id }) { index, order ->
                                val isSplit = order.masterOrderId?.let { (state.splitCounts[it] ?: 0) > 1 } == true
                                RecordsTableRow(
                                    index = index + 1,
                                    order = order,
                                    tableLabel = order.tableId?.let { state.tableNames[it] },
                                    isSplit = isSplit,
                                    currencySymbol = state.currencySymbol,
                                    canDelete = state.deleteModeUnlocked && state.isAdminUser,
                                    onClick = { viewModel.openOrder(order) },
                                    onDeleteRequest = { viewModel.requestDeleteOrder(order) }
                                )
                                HorizontalDivider(color = Color(0xFFF3F4F6))
                            }
                        }
                    }
                }
            }
    }
}

@Composable
private fun RecordsChannelTabs(
    selected: HistoryChannelTab,
    onSelect: (HistoryChannelTab) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        HistoryChannelTab.entries.forEach { tab ->
            val label = when (tab) {
                HistoryChannelTab.IN_STORE -> stringResource(R.string.orders_in_store)
                HistoryChannelTab.THIRD_PARTY -> stringResource(R.string.orders_third_party)
            }
            RecordsTabChip(
                label = label,
                selected = selected == tab,
                compact = false,
                onClick = { onSelect(tab) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun RecordsFilterBar(
    state: OrderHistoryUiState,
    onDate: (HistoryDateFilter) -> Unit,
    onStatus: (PaymentStatus?) -> Unit,
    onType: (ServiceType?) -> Unit,
    onPayment: (PaymentMethod?) -> Unit
) {
    val scrollState = rememberScrollState()
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Color.White,
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(scrollState)
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            FilterSectionLabel("DATE")
            listOf(
                HistoryDateFilter.TODAY to stringResource(R.string.today),
                HistoryDateFilter.YESTERDAY to stringResource(R.string.yesterday),
                HistoryDateFilter.WEEK to "Week",
                HistoryDateFilter.MONTH to stringResource(R.string.month),
                HistoryDateFilter.THREE_MONTHS to "3 Mo",
                HistoryDateFilter.ALL to stringResource(R.string.all)
            ).forEach { (filter, label) ->
                RecordsTabChip(
                    label = label,
                    selected = state.dateFilter == filter,
                    compact = true,
                    onClick = { onDate(filter) }
                )
            }

            FilterDivider()

            FilterSectionLabel("STATUS")
            RecordsTabChip(label = stringResource(R.string.all), selected = state.statusFilter == null, compact = true, onClick = { onStatus(null) })
            PaymentStatus.entries
                .filter { it != PaymentStatus.PENDING && it != PaymentStatus.FAILED }
                .forEach { status ->
                    RecordsTabChip(
                        label = statusShortLabel(status),
                        selected = state.statusFilter == status,
                        compact = true,
                        onClick = { onStatus(status) }
                    )
                }
        }
    }
}

@Composable
private fun FilterSectionLabel(text: String) {
    Text(
        text,
        fontSize = 9.sp,
        color = TextMuted,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 2.dp, end = 2.dp)
    )
}

@Composable
private fun FilterDivider() {
    Box(
        modifier = Modifier
            .height(20.dp)
            .width(1.dp)
            .background(Color(0xFFE5E7EB))
    )
}

private fun statusShortLabel(status: PaymentStatus): String = when (status) {
    PaymentStatus.COMPLETED -> "Done"
    PaymentStatus.REFUNDED -> "Refund"
    PaymentStatus.CANCELLED -> "Cancel"
    PaymentStatus.PARTIALLY_REFUNDED -> "Part"
    else -> status.name.take(6)
}

private fun paymentShortLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> "Cash"
    PaymentMethod.CARD -> "Card"
    PaymentMethod.TAP_TO_PAY -> "Tap"
    PaymentMethod.ADYEN_TERMINAL -> "Term"
    PaymentMethod.PAY_LATER -> "Later"
    PaymentMethod.INVOICE -> "Invoice"
    PaymentMethod.GIFT_CARD -> "Gift"
}

@Composable
private fun RecordsTabChip(
    label: String,
    selected: Boolean,
    compact: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(if (compact) 8.dp else 12.dp),
        color = if (selected) {
            if (compact) Color(0xFF111827) else ChaslayTeal
        } else Color.White,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (selected) {
                if (compact) Color(0xFF111827) else ChaslayTeal
            } else Color(0xFFE5E7EB)
        )
    ) {
        Text(
            label,
            modifier = Modifier.padding(
                horizontal = if (compact) 8.dp else 14.dp,
                vertical = if (compact) 4.dp else 8.dp
            ),
            color = if (selected) Color.White else TextPrimary,
            fontSize = if (compact) 10.sp else 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun RecordsTableHeader(onAdminUnlockTap: () -> Unit = {}) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(HeaderBg)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HeaderCell(stringResource(R.string.time), 76.dp)
        HeaderCell(stringResource(R.string.order_number_short), 80.dp)
        HeaderCell(stringResource(R.string.type), 68.dp)
        HeaderCell(stringResource(R.string.status), 88.dp)
        HeaderCell(stringResource(R.string.amount), 76.dp)
        HeaderCell(stringResource(R.string.payment_method), 56.dp)
        HeaderCell(
            stringResource(R.string.staff),
            72.dp,
            modifier = Modifier.clickable(onClick = onAdminUnlockTap)
        )
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier.width(width),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = TextMuted
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecordsTableRow(
    index: Int,
    order: TransactionEntity,
    tableLabel: String?,
    isSplit: Boolean,
    currencySymbol: String,
    canDelete: Boolean,
    onClick: () -> Unit,
    onDeleteRequest: () -> Unit
) {
    val displayAmount = if (order.refundAmount > 0) {
        (order.total - order.refundAmount).coerceAtLeast(0.0)
    } else {
        order.total
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (index % 2 == 0) Color.White else Color(0xFFFAFAFA))
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CellText(
            SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(order.createdAt)),
            76.dp,
            color = TextMuted
        )
        Row(modifier = Modifier.width(80.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                shortOrderId(order.transactionNumber),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isSplit) {
                Spacer(Modifier.width(4.dp))
                StatusPill("S", Color(0xFFF97316), compact = true)
            }
        }
        Box(modifier = Modifier.width(68.dp)) {
            StatusPill(orderTypeLabel(order.serviceType), orderTypeColor(order.serviceType), compact = true)
        }
        Box(modifier = Modifier.width(88.dp)) {
            StatusPill(orderStatusShort(order.paymentStatus), statusColor(order.paymentStatus), compact = true)
        }
        CellText(
            formatMoney(displayAmount, currencySymbol),
            76.dp,
            fontWeight = FontWeight.Bold
        )
        CellText(paymentShortLabel(order.paymentMethod), 56.dp, color = TextMuted)
        CellText(
            order.userName.take(8),
            72.dp,
            color = TextMuted,
            modifier = if (canDelete) {
                Modifier.combinedClickable(onClick = onDeleteRequest, onLongClick = onDeleteRequest)
            } else {
                Modifier
            }
        )
    }
}

private fun orderStatusShort(status: PaymentStatus): String = when (status) {
    PaymentStatus.COMPLETED -> "Done"
    PaymentStatus.REFUNDED -> "Refund"
    PaymentStatus.CANCELLED -> "Cancel"
    PaymentStatus.PARTIALLY_REFUNDED -> "Part"
    else -> status.name.take(5)
}

@Composable
private fun CellText(
    text: String,
    width: Dp,
    color: Color = TextPrimary,
    fontWeight: FontWeight = FontWeight.Normal,
    modifier: Modifier = Modifier
) {
    Text(
        text,
        modifier = modifier.width(width),
        fontSize = 12.sp,
        color = color,
        fontWeight = fontWeight,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
private fun StatusPill(text: String, color: Color, compact: Boolean = false) {
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.35f))
    ) {
        Text(
            text,
            modifier = Modifier.padding(
                horizontal = if (compact) 5.dp else 8.dp,
                vertical = if (compact) 2.dp else 4.dp
            ),
            fontSize = if (compact) 9.sp else 10.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            maxLines = 1
        )
    }
}

private fun shortOrderId(number: String): String =
    com.chaslay.pos.util.OrderNumberFormat.guestOrderNumber(number).ifBlank {
        number.removePrefix("TX-")
    }

private fun orderTypeLabel(serviceType: ServiceType?): String = when (serviceType) {
    ServiceType.DINE_IN -> "DINE IN"
    ServiceType.TAKEAWAY -> "PICKUP"
    else -> "WALK IN"
}

private fun orderTypeColor(serviceType: ServiceType?): Color = when (serviceType) {
    ServiceType.DINE_IN -> Color(0xFF92400E)
    ServiceType.TAKEAWAY -> Color(0xFF7C3AED)
    else -> Color(0xFF0891B2)
}

private fun statusColor(status: PaymentStatus): Color = when (status) {
    PaymentStatus.COMPLETED -> Color(0xFF059669)
    PaymentStatus.CANCELLED -> Color(0xFFDC2626)
    PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED -> Color(0xFFD97706)
    else -> Color(0xFF6B7280)
}

private fun paymentLabel(method: PaymentMethod): String = when (method) {
    PaymentMethod.CASH -> "Cash"
    PaymentMethod.CARD -> "Card"
    PaymentMethod.ADYEN_TERMINAL -> "Terminal"
    PaymentMethod.TAP_TO_PAY -> "Tap"
    PaymentMethod.PAY_LATER -> "Pay Later"
    PaymentMethod.INVOICE -> "Invoice"
    PaymentMethod.GIFT_CARD -> "Gift card"
}

@Composable
private fun CancelOrderDialog(
    reasons: List<String>,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var selected by remember { mutableStateOf(reasons.firstOrNull().orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.cancel_order)) },
        text = {
            Column {
                reasons.forEach { reason ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selected = reason }
                    ) {
                        RadioButton(selected = selected == reason, onClick = { selected = reason })
                        Text(reason)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selected) }, enabled = selected.isNotBlank()) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
