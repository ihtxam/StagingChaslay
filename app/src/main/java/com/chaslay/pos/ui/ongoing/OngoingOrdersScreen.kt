package com.chaslay.pos.ui.ongoing
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.OngoingOrderCard
import com.chaslay.pos.domain.model.OngoingOrderSource
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.ui.components.ExpandableOrdersSearch
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.util.ScheduledOrderDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OngoingOrdersScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    embeddedInPosTab: Boolean = false,
    reservationOnly: Boolean = false,
    viewModel: OngoingOrdersViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val orders = state.filteredOrders.let { list ->
        if (reservationOnly) list.filter { it.pickupTimeMs != null } else list
    }
    var recordPaymentFor by remember { mutableStateOf<OngoingOrderCard?>(null) }
    val filterChipColors = FilterChipDefaults.filterChipColors(
        containerColor = posUiColors().surface,
        labelColor = posUiColors().textPrimary,
        selectedContainerColor = PosColors.Primary,
        selectedLabelColor = PosColors.TextOnPrimary
    )

    LaunchedEffect(Unit) {
        viewModel.refresh()
    }

    val content: @Composable (Modifier) -> Unit = { paddingMod ->
        Column(
            modifier = paddingMod
                .fillMaxSize()
                .background(posUiColors().canvas)
                .padding(
                    horizontal = if (embeddedInPosTab) PosDimens.PagePaddingCompact else PosDimens.Space3,
                    vertical = if (embeddedInPosTab) 0.dp else PosDimens.Space3
                )
        ) {
            if (!embeddedInPosTab) {
                StandaloneOrdersToolbar(
                    state = state,
                    filterChipColors = filterChipColors,
                    onChannelFilter = viewModel::setChannelFilter,
                    onPaymentFilter = viewModel::setPaymentFilter,
                    searchQuery = state.searchQuery,
                    onSearchChange = viewModel::setSearchQuery,
                    onRefresh = viewModel::refresh
                )
            }

            OrderChannelLegendRibbon(
                modifier = Modifier.padding(
                    top = if (embeddedInPosTab) PosDimens.Space2 else PosDimens.Space3
                )
            )

            if (state.isLoading) {
                Text(
                    stringResource(R.string.loading),
                    color = posUiColors().textSecondary,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            state.errorMessage?.let { msg ->
                Text(msg, color = PosColors.Danger, modifier = Modifier.padding(top = 8.dp))
            }

            if (orders.isEmpty() && !state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(stringResource(R.string.no_ongoing_orders), color = posUiColors().textSecondary)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = if (embeddedInPosTab) PosDimens.Space2 else PosDimens.Space4),
                    contentPadding = PaddingValues(bottom = PosDimens.Space4),
                    horizontalArrangement = Arrangement.spacedBy(PosDimens.GridGap),
                    verticalArrangement = Arrangement.spacedBy(PosDimens.GridGap)
                ) {
                    items(orders, key = { "${it.source}-${it.id}" }) { order ->
                        OngoingOrderCardView(
                            order = order,
                            currencySymbol = state.currencySymbol,
                            onOpen = {
                                if (order.source != OngoingOrderSource.TRANSACTION) {
                                    viewModel.resumeOrder(order, onBack)
                                }
                            },
                            onPrint = { viewModel.printReceiptForOrder(order) },
                            onSendKitchen = { viewModel.sendKitchenForOrder(order) },
                            onOpenInvoice = if (order.paymentMethod == PaymentMethod.INVOICE) {
                                { viewModel.openInvoicePdf(order) }
                            } else null,
                            onRecordPayment = if (order.paymentMethod == PaymentMethod.INVOICE) {
                                { recordPaymentFor = order }
                            } else null
                        )
                    }
                }
            }
        }
    }

    if (embedded) {
        content(Modifier.fillMaxSize())
    } else {
        Scaffold(
            containerColor = posUiColors().canvas,
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.ongoing_orders)) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    }
                )
            }
        ) { padding ->
            content(Modifier.padding(padding))
        }
    }

    recordPaymentFor?.let { card ->
        AlertDialog(
            onDismissRequest = { recordPaymentFor = null },
            title = { Text(stringResource(R.string.invoice_record_payment)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("#${card.orderNumber}")
                    Text(stringResource(R.string.invoice_mark_paid_hint))
                    Text(stringResource(R.string.invoice_bank_transfer))
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.recordInvoicePayment(card, "invoice")
                        recordPaymentFor = null
                    }
                ) { Text(stringResource(R.string.invoice_mark_paid)) }
            },
            dismissButton = {
                TextButton(onClick = { recordPaymentFor = null }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }
}

@Composable
private fun OrderChannelLegendRibbon(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = PosShapes.Medium,
        color = posUiColors().surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = PosDimens.Space3, vertical = PosDimens.Space2),
            horizontalArrangement = Arrangement.spacedBy(PosDimens.Space4, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OrderChannelLegendItem(
                color = PosColors.Success,
                label = stringResource(R.string.dine_in)
            )
            OrderChannelLegendItem(
                color = PosColors.Warning,
                label = stringResource(R.string.delivery)
            )
            OrderChannelLegendItem(
                color = PosColors.Info,
                label = stringResource(R.string.takeaway)
            )
        }
    }
}

@Composable
private fun OrderChannelLegendItem(color: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(width = 14.dp, height = 10.dp)
                .clip(PosShapes.Small)
                .background(color)
        )
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = posUiColors().textSecondary)
    }
}

@Composable
private fun StandaloneOrdersToolbar(
    state: OngoingOrdersUiState,
    filterChipColors: androidx.compose.material3.SelectableChipColors,
    onChannelFilter: (OrdersChannelFilter) -> Unit,
    onPaymentFilter: (OrdersPaymentFilter) -> Unit,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onRefresh: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterChip(
                selected = state.channelFilter == OrdersChannelFilter.ALL,
                onClick = { onChannelFilter(OrdersChannelFilter.ALL) },
                label = { Text(stringResource(R.string.orders_tab_all)) },
                colors = filterChipColors
            )
            FilterChip(
                selected = state.channelFilter == OrdersChannelFilter.TAKEAWAY,
                onClick = { onChannelFilter(OrdersChannelFilter.TAKEAWAY) },
                label = { Text(stringResource(R.string.pickup)) },
                colors = filterChipColors
            )
            FilterChip(
                selected = state.channelFilter == OrdersChannelFilter.DELIVERY,
                onClick = { onChannelFilter(OrdersChannelFilter.DELIVERY) },
                label = { Text(stringResource(R.string.delivery)) },
                colors = filterChipColors
            )
            FilterChip(
                selected = state.paymentFilter == OrdersPaymentFilter.UNPAID,
                onClick = {
                    onPaymentFilter(
                        if (state.paymentFilter == OrdersPaymentFilter.UNPAID) {
                            OrdersPaymentFilter.ALL
                        } else {
                            OrdersPaymentFilter.UNPAID
                        }
                    )
                },
                label = { Text(stringResource(R.string.orders_filter_unpaid)) },
                colors = filterChipColors
            )
        }
        ExpandableOrdersSearch(
            query = searchQuery,
            onQueryChange = onSearchChange,
            placeholderRes = R.string.orders_search_orders_hint,
            expandedMinWidth = 160.dp,
            expandedMaxWidth = 240.dp
        )
        IconButton(onClick = onRefresh) {
            Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
        }
    }
}

@Composable
private fun OngoingOrderCardView(
    order: OngoingOrderCard,
    currencySymbol: String,
    onOpen: () -> Unit,
    onPrint: () -> Unit,
    onSendKitchen: () -> Unit,
    onOpenInvoice: (() -> Unit)? = null,
    onRecordPayment: (() -> Unit)? = null
) {
    val isCompleted = order.source == OngoingOrderSource.TRANSACTION
    val statusStyle = ongoingStatusStyle(order)
    var menuOpen by remember { mutableStateOf(false) }
    val typeIcon = fulfillmentIcon(order)
    val typeLabel = channelLabel(order)
    val clientLabel = order.customerLabel?.takeIf { it.isNotBlank() }
        ?: order.tableName?.takeIf { it.isNotBlank() }
        ?: "—"

    val channelAccent = orderChannelAccentColor(order)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = PosShapes.ExtraLarge,
        color = posUiColors().surface,
        shadowElevation = 1.dp,
        border = androidx.compose.foundation.BorderStroke(2.dp, channelAccent)
    ) {
        Column(
            modifier = Modifier.padding(PosDimens.Space4),
            verticalArrangement = Arrangement.spacedBy(PosDimens.Space3)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OngoingStatusBadge(
                    label = order.statusLabel,
                    dotColor = statusStyle.dot,
                    background = statusStyle.background
                )
                Text(
                    formatElapsedLabel(order),
                    color = posUiColors().textMuted,
                    fontSize = 11.sp,
                    maxLines = 1
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "#${order.orderNumber}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = posUiColors().textPrimary
                    )
                    Text(
                        formatMoney(order.total, currencySymbol),
                        color = PosColors.Primary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                    Text(
                        stringResource(R.string.order_items_count, order.itemCount),
                        color = posUiColors().textMuted,
                        fontSize = 11.sp
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(typeIcon, contentDescription = null, tint = posUiColors().textMuted, modifier = Modifier.size(14.dp))
                        Text(typeLabel, fontSize = 11.sp, color = posUiColors().textSecondary, maxLines = 1)
                    }
                    Text(
                        stringResource(R.string.orders_client_label, clientLabel),
                        fontSize = 10.sp,
                        color = posUiColors().textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(PosDimens.Space2),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = onOpen,
                    enabled = !isCompleted,
                    modifier = Modifier.weight(1f),
                    shape = PosShapes.Medium,
                    colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary)
                ) {
                    Text(stringResource(R.string.orders_open), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                OutlinedButton(
                    onClick = onPrint,
                    modifier = Modifier.size(PosDimens.ControlHeightMd),
                    shape = PosShapes.Medium,
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Icon(Icons.Default.Print, contentDescription = stringResource(R.string.print_receipt), tint = posUiColors().textSecondary)
                }
                Box {
                    OutlinedButton(
                        onClick = { menuOpen = true },
                        modifier = Modifier.size(PosDimens.ControlHeightMd),
                        shape = PosShapes.Medium,
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Icon(Icons.Default.MoreHoriz, contentDescription = null, tint = posUiColors().textSecondary)
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        if (!isCompleted) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.send_to_kitchen)) },
                                onClick = {
                                    menuOpen = false
                                    onSendKitchen()
                                },
                                leadingIcon = { Icon(Icons.Default.Restaurant, null) }
                            )
                        }
                        onOpenInvoice?.let { open ->
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.invoice_open_pdf)) },
                                onClick = {
                                    menuOpen = false
                                    open()
                                },
                                leadingIcon = { Icon(Icons.Default.Description, null) }
                            )
                        }
                        onRecordPayment?.let { pay ->
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.invoice_record_payment)) },
                                onClick = {
                                    menuOpen = false
                                    pay()
                                },
                                leadingIcon = { Icon(Icons.Default.Payments, null) }
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun orderChannelAccentColor(order: OngoingOrderCard): Color = when (order.fulfillmentType) {
    FulfillmentType.DINE_IN -> PosColors.Success
    FulfillmentType.DELIVERY -> PosColors.Warning
    FulfillmentType.PICKUP -> PosColors.Info
    FulfillmentType.WALK_IN -> when (order.serviceType) {
        ServiceType.DINE_IN -> PosColors.Success
        ServiceType.TAKEAWAY -> PosColors.Info
    }
}

private data class OngoingStatusStyle(val dot: Color, val background: Color)

@Composable
private fun ongoingStatusStyle(order: OngoingOrderCard): OngoingStatusStyle {
    val ui = posUiColors()
    val label = order.statusLabel.lowercase(Locale.getDefault())
    return when {
        OngoingOrdersViewModel.isUnpaid(order) ->
            OngoingStatusStyle(PosColors.Info, ui.infoSubtle)
        label.contains("réserv") || label.contains("reserv") || order.pickupTimeMs != null ->
            OngoingStatusStyle(PosColors.Warning, ui.warningSubtle)
        label.contains("prépar") || label.contains("prepar") || label.contains("kitchen") ->
            OngoingStatusStyle(PosColors.Info, ui.infoSubtle)
        label.contains("pay") || label.contains("attente") ->
            OngoingStatusStyle(Color(0xFF7C3AED), Color(0xFFF3E8FF))
        else -> OngoingStatusStyle(PosColors.Success, ui.successSubtle)
    }
}

@Composable
private fun OngoingStatusBadge(label: String, dotColor: Color, background: Color) {
    Surface(color = background, shape = PosShapes.Pill) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = posUiColors().textPrimary, maxLines = 1)
        }
    }
}

@Composable
private fun channelLabel(order: OngoingOrderCard): String = when (order.fulfillmentType) {
    FulfillmentType.PICKUP -> stringResource(R.string.pickup)
    FulfillmentType.DELIVERY -> stringResource(R.string.delivery)
    FulfillmentType.DINE_IN -> stringResource(R.string.dine_in)
    FulfillmentType.WALK_IN -> when (order.serviceType) {
        ServiceType.DINE_IN -> stringResource(R.string.dine_in)
        ServiceType.TAKEAWAY -> stringResource(R.string.pickup)
    }
}

private fun fulfillmentIcon(order: OngoingOrderCard): ImageVector = when (order.fulfillmentType) {
    FulfillmentType.DELIVERY -> Icons.Default.LocalShipping
    FulfillmentType.PICKUP -> Icons.Default.ShoppingBag
    FulfillmentType.DINE_IN -> Icons.Default.Restaurant
    FulfillmentType.WALK_IN -> when (order.serviceType) {
        ServiceType.DINE_IN -> Icons.Default.Restaurant
        ServiceType.TAKEAWAY -> Icons.Default.ShoppingBag
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

@Composable
private fun formatElapsedLabel(order: OngoingOrderCard): String {
    order.pickupTimeMs?.let { pickup ->
        val delta = pickup - System.currentTimeMillis()
        if (delta > 0) {
            val minutes = (delta / 60_000).toInt().coerceAtLeast(1)
            return stringResource(R.string.orders_in_min, minutes)
        }
    }
    val minutes = ((System.currentTimeMillis() - order.updatedAt) / 60_000).toInt().coerceAtLeast(0)
    return when {
        minutes < 1 -> stringResource(R.string.time_just_now)
        minutes < 60 -> stringResource(R.string.time_min_ago, minutes)
        else -> "${minutes / 60}h ${minutes % 60}m"
    }
}
