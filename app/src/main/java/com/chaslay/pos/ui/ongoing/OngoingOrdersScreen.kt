package com.chaslay.pos.ui.ongoing

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.ui.theme.vectronColors
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OngoingOrdersScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: OngoingOrdersViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val orders = state.filteredOrders
    val colors = vectronColors()
    val filterChipColors = FilterChipDefaults.filterChipColors(
        containerColor = Color(0xFFE8E8E8),
        labelColor = Color(0xFF333333),
        selectedContainerColor = Color(0xFF111111),
        selectedLabelColor = Color.White
    )

    LaunchedEffect(Unit) {
        viewModel.refresh()
    }

    val content: @Composable (Modifier) -> Unit = { paddingMod ->
        Column(
            modifier = paddingMod
                .fillMaxSize()
                .background(colors.background)
                .padding(12.dp)
        ) {
            var searchOpen by remember { mutableStateOf(state.searchQuery.isNotBlank()) }
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
                        selected = state.statusFilter == OrdersStatusFilter.ACTIVE,
                        onClick = { viewModel.setStatusFilter(OrdersStatusFilter.ACTIVE) },
                        label = { Text(stringResource(R.string.orders_filter_active)) },
                        colors = filterChipColors
                    )
                    FilterChip(
                        selected = state.statusFilter == OrdersStatusFilter.COMPLETED,
                        onClick = { viewModel.setStatusFilter(OrdersStatusFilter.COMPLETED) },
                        label = { Text(stringResource(R.string.orders_filter_completed)) },
                        colors = filterChipColors
                    )
                    FilterChip(
                        selected = state.channelFilter == OrdersChannelFilter.ALL,
                        onClick = { viewModel.setChannelFilter(OrdersChannelFilter.ALL) },
                        label = { Text(stringResource(R.string.all)) },
                        colors = filterChipColors
                    )
                    FilterChip(
                        selected = state.channelFilter == OrdersChannelFilter.DINE_IN,
                        onClick = { viewModel.setChannelFilter(OrdersChannelFilter.DINE_IN) },
                        label = { Text(stringResource(R.string.dine_in)) },
                        colors = filterChipColors
                    )
                    FilterChip(
                        selected = state.channelFilter == OrdersChannelFilter.TAKEAWAY,
                        onClick = { viewModel.setChannelFilter(OrdersChannelFilter.TAKEAWAY) },
                        label = { Text(stringResource(R.string.pickup)) },
                        colors = filterChipColors
                    )
                    FilterChip(
                        selected = state.channelFilter == OrdersChannelFilter.DELIVERY,
                        onClick = { viewModel.setChannelFilter(OrdersChannelFilter.DELIVERY) },
                        label = { Text(stringResource(R.string.delivery)) },
                        colors = filterChipColors
                    )
                    if (state.statusFilter == OrdersStatusFilter.ACTIVE) {
                        FilterChip(
                            selected = state.paymentFilter == OrdersPaymentFilter.UNPAID,
                            onClick = {
                                viewModel.setPaymentFilter(
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
                }
                if (searchOpen) {
                    OutlinedTextField(
                        value = state.searchQuery,
                        onValueChange = viewModel::setSearchQuery,
                        modifier = Modifier
                            .widthIn(min = 160.dp, max = 240.dp)
                            .height(52.dp),
                        singleLine = true,
                        placeholder = { Text(stringResource(R.string.orders_search_hint), fontSize = 13.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
                IconButton(
                    onClick = {
                        if (searchOpen) {
                            viewModel.setSearchQuery("")
                            searchOpen = false
                        } else {
                            searchOpen = true
                        }
                    }
                ) {
                    Icon(
                        if (searchOpen) Icons.Default.Close else Icons.Default.Search,
                        contentDescription = stringResource(R.string.orders_search_hint),
                        tint = colors.textPrimary
                    )
                }
            }

            if (state.isLoading) {
                Text(
                    stringResource(R.string.loading),
                    color = colors.textSecondary,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            state.errorMessage?.let { msg ->
                Text(msg, color = Color(0xFFC0392B), modifier = Modifier.padding(top = 8.dp))
            }

            if (orders.isEmpty() && !state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        if (state.statusFilter == OrdersStatusFilter.COMPLETED) {
                            stringResource(R.string.orders_no_completed)
                        } else {
                            stringResource(R.string.no_ongoing_orders)
                        },
                        color = colors.textSecondary
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 180.dp),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 20.dp),
                    contentPadding = PaddingValues(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(orders, key = { "${it.source}-${it.id}" }) { order ->
                        OngoingOrderCardView(
                            order = order,
                            currencySymbol = state.currencySymbol,
                            onClick = {
                                if (order.source != OngoingOrderSource.TRANSACTION) {
                                    viewModel.resumeOrder(order, onBack)
                                }
                            },
                            onPrint = { viewModel.printReceiptForOrder(order) },
                            onSendKitchen = { viewModel.sendKitchenForOrder(order) }
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
}

@Composable
private fun OngoingOrderCardView(
    order: OngoingOrderCard,
    currencySymbol: String,
    onClick: () -> Unit,
    onPrint: () -> Unit,
    onSendKitchen: () -> Unit
) {
    val headerColor = channelHeaderColor(order)
    val channelLabel = channelLabel(order)
    val isUnpaid = OngoingOrdersViewModel.isUnpaid(order)
    val isCompleted = order.source == OngoingOrderSource.TRANSACTION
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(210.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF1A1A1A))
            .clickable(onClick = onClick, enabled = !isCompleted)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(headerColor)
                    .padding(horizontal = 10.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(channelLabel, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Text("#${order.orderNumber}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = formatMoney(order.total, currencySymbol),
                        color = Color(0xFFF1C40F),
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusBadge(order.statusLabel)
                        if (isUnpaid) {
                            StatusBadge(
                                text = stringResource(R.string.orders_awaiting_payment),
                                background = Color(0xFF5B21B6),
                                content = Color.White
                            )
                        }
                    }
                    order.customerLabel?.takeIf { it.isNotBlank() }?.let { customer ->
                        Text(
                            customer,
                            color = Color(0xFFCCCCCC),
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    order.pickupTimeMs?.let { pickup ->
                        Text(
                            formatScheduledTime(pickup),
                            color = Color(0xFFE67E22),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        stringResource(R.string.order_items_count, order.itemCount),
                        color = Color(0xFFAAAAAA),
                        fontSize = 11.sp
                    )
                    Text(
                        formatElapsedLabel(order.updatedAt),
                        color = Color(0xFFE74C3C),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF111111))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OngoingActionIcon(Icons.Default.Print, onPrint)
                if (!isCompleted) {
                    OngoingActionIcon(Icons.Default.Restaurant, onSendKitchen)
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    background: Color = Color(0xFF333333),
    content: Color = Color(0xFFF1C40F)
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = background
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            color = content,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun OngoingActionIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF3A3A3A)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
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

private fun channelHeaderColor(order: OngoingOrderCard): Color = when (order.fulfillmentType) {
    FulfillmentType.DELIVERY -> Color(0xFFE67E22)
    FulfillmentType.PICKUP -> Color(0xFF0288D1)
    FulfillmentType.DINE_IN -> Color(0xFF2E7D32)
    FulfillmentType.WALK_IN -> when (order.serviceType) {
        ServiceType.DINE_IN -> Color(0xFF2E7D32)
        ServiceType.TAKEAWAY -> Color(0xFF0288D1)
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatScheduledTime(pickupTimeMs: Long): String {
    val fmt = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())
    return fmt.format(pickupTimeMs)
}

@Composable
private fun formatElapsedLabel(updatedAt: Long): String {
    val minutes = ((System.currentTimeMillis() - updatedAt) / 60_000).toInt().coerceAtLeast(0)
    return when {
        minutes < 1 -> stringResource(R.string.time_just_now)
        minutes < 60 -> stringResource(R.string.time_min_ago, minutes)
        else -> "${minutes / 60}h ${minutes % 60}m"
    }
}
