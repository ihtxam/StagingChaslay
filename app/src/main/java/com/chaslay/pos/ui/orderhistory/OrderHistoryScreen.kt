package com.chaslay.pos.ui.orderhistory
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
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
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: OrderHistoryViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

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
            canDelete = state.deleteModeUnlocked && state.isAdminUser &&
                OrderHistoryPurge.isGandolaPurgeEligible(order),
            onDismiss = viewModel::closeOrderDetail,
            onPrint = viewModel::printSelectedOrder,
            onPrintCustomerCard = viewModel::printAdyenCustomerReceiptForSelected,
            onPrintMerchantCard = viewModel::printAdyenCashierReceiptForSelected,
            onPrintAllSplits = viewModel::printAllSplitOrders,
            onPrintSplit = viewModel::printSplitOrder,
            onCancel = viewModel::showCancelDialog,
            onRefund = viewModel::showRefundDialog,
            onChangePayment = viewModel::showPaymentEditDialog,
            onDelete = { viewModel.requestDeleteOrder(order) }
        )
    }

    if (state.showPaymentEditDialog) {
        val order = state.selectedOrder
        if (order != null) {
            ChangePaymentMethodDialog(
                currentMethod = order.paymentMethod,
                onDismiss = viewModel::dismissPaymentEditDialog,
                onConfirm = viewModel::updateSelectedOrderPaymentMethod
            )
        }
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
            onPrintReceipt = viewModel::printLastRefundReceipt
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
            title = { Text(stringResource(R.string.order_history_purge_delete_selected)) },
            text = {
                Text(
                    stringResource(
                        R.string.order_history_purge_confirm,
                        state.bulkDeleteCount
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
            showRefresh = true,
            compactLayout = true
        )
    } else {
        Scaffold(
            containerColor = posUiColors().canvas,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(stringResource(R.string.order_records), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(
                                stringResource(R.string.order_history),
                                fontSize = 11.sp,
                                color = posUiColors().textSecondary
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    },
                    actions = {
                        IconButton(onClick = viewModel::refresh) {
                            Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
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
    showRefresh: Boolean = false,
    compactLayout: Boolean = false
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(posUiColors().canvas)
            .padding(horizontal = PosDimens.PagePaddingCompact, vertical = PosDimens.Space2)
    ) {
        if (showRefresh && !compactLayout) {
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
        RecordsSearchRow(
            query = state.searchQuery,
            dateFilter = state.dateFilter,
            onQueryChange = viewModel::setSearchQuery,
            onDateChange = viewModel::setDateFilter,
            onRefresh = viewModel::refresh,
            showRefresh = showRefresh || compactLayout
        )
        Spacer(modifier = Modifier.height(PosDimens.Space3))

        if (state.deleteModeUnlocked && state.isAdminUser) {
            OrderHistoryPurgeToolbar(
                selectedCount = state.selectedPurgeOrderIds.size,
                eligibleOnPageCount = state.orders.count { OrderHistoryPurge.isGandolaPurgeEligible(it) },
                onSelectAll = viewModel::selectAllPurgeEligibleOnPage,
                onClearSelection = viewModel::clearPurgeSelection,
                onDeleteSelected = viewModel::requestDeleteSelectedPurge,
                onExit = viewModel::exitDeleteMode
            )
            Spacer(modifier = Modifier.height(PosDimens.Space2))
        }

        Surface(
            modifier = Modifier.fillMaxSize(),
            shape = PosShapes.ExtraLarge,
            color = posUiColors().surface,
            shadowElevation = 1.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                RecordsTableHeader(
                    purgeMode = state.deleteModeUnlocked && state.isAdminUser,
                    onAdminUnlockTap = viewModel::onAdminUnlockTap
                )
                HorizontalDivider(color = posUiColors().border)
                if (state.orders.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(stringResource(R.string.no_orders_found), color = posUiColors().textSecondary)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                    ) {
                        itemsIndexed(state.orders, key = { _, order -> order.id }) { index, order ->
                            val globalIndex = (state.currentPage - 1) * state.pageSize + index + 1
                            val isSplit = order.masterOrderId?.let { (state.splitCounts[it] ?: 0) > 1 } == true
                            val purgeEligible = OrderHistoryPurge.isGandolaPurgeEligible(order)
                            RecordsTableRow(
                                index = globalIndex,
                                order = order,
                                tableLabel = order.tableId?.let { state.tableNames[it] },
                                isSplit = isSplit,
                                isSelected = state.selectedOrder?.id == order.id,
                                currencySymbol = state.currencySymbol,
                                purgeMode = state.deleteModeUnlocked && state.isAdminUser,
                                purgeEligible = purgeEligible,
                                purgeSelected = order.id in state.selectedPurgeOrderIds,
                                onClick = { viewModel.openOrder(order) },
                                onPurgeToggle = { viewModel.togglePurgeSelection(order) }
                            )
                            HorizontalDivider(color = posUiColors().canvas)
                        }
                    }
                    RecordsPaginationBar(
                        currentPage = state.currentPage,
                        totalPages = state.totalPages,
                        totalCount = state.totalFilteredCount,
                        pageSize = state.pageSize,
                        onPrevious = viewModel::previousPage,
                        onNext = viewModel::nextPage
                    )
                }
            }
        }
    }
}

@Composable
private fun RecordsPaginationBar(
    currentPage: Int,
    totalPages: Int,
    totalCount: Int,
    pageSize: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit
) {
    if (totalCount <= pageSize) return
    val from = ((currentPage - 1) * pageSize) + 1
    val to = minOf(currentPage * pageSize, totalCount)
    HorizontalDivider(color = posUiColors().border)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(posUiColors().surfaceSubtle)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedButton(
            onClick = onPrevious,
            enabled = currentPage > 1,
            modifier = Modifier.height(36.dp)
        ) {
            Text(stringResource(R.string.previous_page), fontSize = 12.sp)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                stringResource(R.string.order_history_page_of, currentPage, totalPages),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = posUiColors().textPrimary
            )
            Text(
                stringResource(R.string.order_history_showing_range, from, to, totalCount),
                fontSize = 10.sp,
                color = posUiColors().textSecondary
            )
        }
        OutlinedButton(
            onClick = onNext,
            enabled = currentPage < totalPages,
            modifier = Modifier.height(36.dp)
        ) {
            Text(stringResource(R.string.next_page), fontSize = 12.sp)
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
private fun RecordsSearchRow(
    query: String,
    dateFilter: HistoryDateFilter,
    onQueryChange: (String) -> Unit,
    onDateChange: (HistoryDateFilter) -> Unit,
    onRefresh: () -> Unit,
    showRefresh: Boolean
) {
    var dateMenuOpen by remember { mutableStateOf(false) }
    val dateLabel = when (dateFilter) {
        HistoryDateFilter.TODAY -> stringResource(R.string.today)
        HistoryDateFilter.YESTERDAY -> stringResource(R.string.yesterday)
        HistoryDateFilter.WEEK -> stringResource(R.string.week)
        HistoryDateFilter.MONTH -> stringResource(R.string.month)
        HistoryDateFilter.THREE_MONTHS -> stringResource(R.string.order_history_three_months)
        HistoryDateFilter.ALL -> stringResource(R.string.all)
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(PosDimens.Space2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text(stringResource(R.string.order_history_search_hint), fontSize = 13.sp) },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = stringResource(R.string.search_orders), tint = posUiColors().textMuted)
            },
            singleLine = true,
            shape = PosShapes.ExtraLarge,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PosColors.Primary,
                unfocusedBorderColor = posUiColors().border,
                focusedContainerColor = posUiColors().surface,
                unfocusedContainerColor = posUiColors().surface,
                cursorColor = PosColors.Primary
            )
        )
        Box {
            Surface(
                onClick = { dateMenuOpen = true },
                shape = PosShapes.Medium,
                color = posUiColors().surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.CalendarToday, contentDescription = null, tint = posUiColors().textMuted, modifier = Modifier.size(16.dp))
                    Text(dateLabel, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = posUiColors().textPrimary)
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = posUiColors().textMuted, modifier = Modifier.size(18.dp))
                }
            }
            DropdownMenu(expanded = dateMenuOpen, onDismissRequest = { dateMenuOpen = false }) {
                listOf(
                    HistoryDateFilter.TODAY to stringResource(R.string.today),
                    HistoryDateFilter.YESTERDAY to stringResource(R.string.yesterday),
                    HistoryDateFilter.WEEK to stringResource(R.string.week),
                    HistoryDateFilter.MONTH to stringResource(R.string.month),
                    HistoryDateFilter.THREE_MONTHS to stringResource(R.string.order_history_three_months),
                    HistoryDateFilter.ALL to stringResource(R.string.all)
                ).forEach { (filter, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            dateMenuOpen = false
                            onDateChange(filter)
                        }
                    )
                }
            }
        }
        if (showRefresh) {
            IconButton(onClick = onRefresh) {
                Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
            }
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
        color = posUiColors().surface,
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
            FilterSectionLabel(stringResource(R.string.order_history_filter_date))
            listOf(
                HistoryDateFilter.TODAY to stringResource(R.string.today),
                HistoryDateFilter.YESTERDAY to stringResource(R.string.yesterday),
                HistoryDateFilter.WEEK to stringResource(R.string.week),
                HistoryDateFilter.MONTH to stringResource(R.string.month),
                HistoryDateFilter.THREE_MONTHS to stringResource(R.string.order_history_three_months),
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

            FilterSectionLabel(stringResource(R.string.order_history_filter_status))
            RecordsTabChip(label = stringResource(R.string.all), selected = state.statusFilter == null, compact = true, onClick = { onStatus(null) })
            PaymentStatus.entries
                .filter { it != PaymentStatus.PENDING && it != PaymentStatus.FAILED }
                .forEach { status ->
                    RecordsTabChip(
                        label = orderHistoryPaymentStatusChipLabel(status),
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
        color = posUiColors().textSecondary,
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
            .background(posUiColors().border)
    )
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
        color = if (selected) PosColors.Primary else posUiColors().surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (selected) PosColors.Primary else posUiColors().border
        )
    ) {
        Text(
            label,
            modifier = Modifier.padding(
                horizontal = if (compact) 8.dp else 14.dp,
                vertical = if (compact) 4.dp else 8.dp
            ),
            color = if (selected) PosColors.TextOnPrimary else posUiColors().textPrimary,
            fontSize = if (compact) 10.sp else 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun OrderHistoryPurgeToolbar(
    selectedCount: Int,
    eligibleOnPageCount: Int,
    onSelectAll: () -> Unit,
    onClearSelection: () -> Unit,
    onDeleteSelected: () -> Unit,
    onExit: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = PosShapes.Medium,
        color = Color(0xFFFFFBEB),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCD34D))
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(
                stringResource(R.string.order_history_purge_mode),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF92400E)
            )
            Text(
                stringResource(R.string.order_history_purge_cash_only_hint),
                fontSize = 10.sp,
                color = Color(0xFFB45309),
                modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onSelectAll,
                    enabled = eligibleOnPageCount > 0,
                    modifier = Modifier.height(32.dp)
                ) {
                    Text(
                        stringResource(R.string.order_history_purge_select_all, eligibleOnPageCount),
                        fontSize = 11.sp
                    )
                }
                if (selectedCount > 0) {
                    TextButton(onClick = onClearSelection) {
                        Text(
                            stringResource(R.string.order_history_purge_clear_selection),
                            fontSize = 11.sp
                        )
                    }
                }
                Button(
                    onClick = onDeleteSelected,
                    enabled = selectedCount > 0,
                    modifier = Modifier.height(32.dp),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = PosColors.Danger
                    )
                ) {
                    Text(
                        stringResource(R.string.order_history_purge_delete_selected, selectedCount),
                        fontSize = 11.sp
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                TextButton(onClick = onExit) {
                    Text(stringResource(R.string.order_history_purge_exit), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun RecordsTableHeader(
    purgeMode: Boolean = false,
    onAdminUnlockTap: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(posUiColors().surfaceSubtle)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (purgeMode) {
            Spacer(modifier = Modifier.width(36.dp))
        }
        HeaderCell(stringResource(R.string.order_number_short), 72.dp, modifier = Modifier.clickable(onClick = onAdminUnlockTap))
        HeaderCell(stringResource(R.string.order_history_date), 120.dp)
        HeaderCell(stringResource(R.string.order_history_articles), 0.dp, modifier = Modifier.weight(1f))
        HeaderCell(stringResource(R.string.total), 76.dp)
        HeaderCell(stringResource(R.string.status), 92.dp)
        HeaderCell(stringResource(R.string.type), 72.dp)
        HeaderCell(stringResource(R.string.staff), 72.dp)
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = if (width > 0.dp) modifier.width(width) else modifier,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = posUiColors().textSecondary
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecordsTableRow(
    index: Int,
    order: TransactionEntity,
    tableLabel: String?,
    isSplit: Boolean,
    isSelected: Boolean,
    currencySymbol: String,
    purgeMode: Boolean,
    purgeEligible: Boolean,
    purgeSelected: Boolean,
    onClick: () -> Unit,
    onPurgeToggle: () -> Unit
) {
    val displayAmount = if (order.refundAmount > 0) {
        (order.total - order.refundAmount).coerceAtLeast(0.0)
    } else {
        order.total
    }
    val rowBg = when {
        purgeMode && purgeSelected -> Color(0xFFFEE2E2)
        isSelected -> posUiColors().surfaceSelected
        index % 2 == 0 -> posUiColors().surface
        else -> posUiColors().surfaceSubtle
    }
    val dateText = SimpleDateFormat("dd MMM yyyy · HH:mm", Locale.getDefault()).format(Date(order.createdAt))
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(rowBg)
            .then(
                if (isSelected) {
                    Modifier.border(
                        width = 1.dp,
                        color = PosColors.Primary,
                        shape = RoundedCornerShape(0.dp)
                    )
                } else {
                    Modifier
                }
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (purgeMode) {
            Box(modifier = Modifier.width(36.dp)) {
                if (purgeEligible) {
                    Checkbox(
                        checked = purgeSelected,
                        onCheckedChange = { onPurgeToggle() },
                        modifier = Modifier.size(32.dp),
                        colors = CheckboxDefaults.colors(checkedColor = PosColors.Danger)
                    )
                }
            }
        }
        Row(modifier = Modifier.width(72.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                shortOrderId(order.transactionNumber, order.notes),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = posUiColors().textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isSplit) {
                Spacer(Modifier.width(4.dp))
                StatusPill(stringResource(R.string.order_history_split_badge), Color(0xFFF97316), compact = true)
            }
        }
        CellText(dateText, 120.dp, color = posUiColors().textSecondary, fontSize = 11.sp)
        Text(
            stringResource(R.string.order_history_articles_preview_placeholder),
            modifier = Modifier.weight(1f).padding(end = 8.dp),
            fontSize = 12.sp,
            color = posUiColors().textSecondary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        CellText(
            formatMoney(displayAmount, currencySymbol),
            76.dp,
            fontWeight = FontWeight.Bold
        )
        Box(modifier = Modifier.width(92.dp)) {
            StatusPill(
                orderHistoryPaymentStatusChipLabel(order.paymentStatus),
                statusColor(order.paymentStatus),
                compact = true
            )
        }
        Box(modifier = Modifier.width(72.dp)) {
            StatusPill(orderHistoryServiceTypeChipLabel(order.serviceType), orderTypeColor(order.serviceType), compact = true)
        }
        CellText(order.userName, 72.dp, color = posUiColors().textSecondary)
    }
}

@Composable
private fun CellText(
    text: String,
    width: Dp,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight = FontWeight.Normal,
    fontSize: androidx.compose.ui.unit.TextUnit = 12.sp,
    modifier: Modifier = Modifier
) {
    val resolvedColor = if (color == Color.Unspecified) posUiColors().textPrimary else color
    Text(
        text,
        modifier = modifier.width(width),
        fontSize = fontSize,
        color = resolvedColor,
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

private fun shortOrderId(number: String, notes: String? = null): String {
    val meta = com.chaslay.pos.util.parseOrderMetaFromNotes(notes)
    return com.chaslay.pos.util.OrderNumberFormat.guestOrderNumber(
        orderNumber = number,
        orderDisplay = meta.ticketDisplay,
        tabNumber = meta.tabNumber
    ).ifBlank {
        com.chaslay.pos.util.OrderNumberFormat.formatOrderNumberDisplay(number)
            .ifBlank { number.removePrefix("TX-") }
    }
}

private fun orderTypeColor(serviceType: ServiceType?): Color = when (serviceType) {
    ServiceType.DINE_IN -> PosColors.Warning
    ServiceType.TAKEAWAY -> PosColors.Info
    else -> PosColors.Primary
}

private fun statusColor(status: PaymentStatus): Color = when (status) {
    PaymentStatus.COMPLETED -> PosColors.Primary
    PaymentStatus.CANCELLED -> PosColors.Danger
    PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED -> PosColors.Warning
    else -> PosColors.TextSecondary
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
