package com.chaslay.pos.ui.programmed
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.border
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Print
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.ProgrammedOrderCard
import com.chaslay.pos.domain.model.ProgrammedOrderSource
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.vectronColors
import com.chaslay.pos.util.ScheduledOrderDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgrammedOrdersScreen(
    onBack: () -> Unit,
    embedded: Boolean = false,
    viewModel: ProgrammedOrdersViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()

    LaunchedEffect(Unit) { viewModel.refresh() }

    state.message?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text(stringResource(R.string.confirm)) } },
            title = { Text(stringResource(R.string.programmed_orders)) },
            text = { Text(message) }
        )
    }

    val content: @Composable (Modifier) -> Unit = { paddingMod ->
        Column(
            modifier = paddingMod
                .fillMaxSize()
                .background(colors.background)
                .padding(12.dp)
        ) {
            if (state.isLoading) {
                Text(stringResource(R.string.loading), color = colors.textSecondary, modifier = Modifier.padding(8.dp))
            }
            state.errorMessage?.let { msg ->
                Text(msg, color = PosColors.Danger, modifier = Modifier.padding(8.dp))
            }
            if (state.groups.isEmpty() && !state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.no_programmed_orders), color = colors.textSecondary)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    state.groups.forEach { group ->
                        item(key = "header-${group.dayKey}") {
                            ProgrammedDayHeader(group)
                        }
                        group.orders.chunked(2).forEachIndexed { rowIndex, rowOrders ->
                            item(key = "row-${group.dayKey}-$rowIndex") {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    rowOrders.forEach { order ->
                                        Box(modifier = Modifier.weight(1f)) {
                                            ProgrammedOrderCardView(
                                                order = order,
                                                currencySymbol = state.currencySymbol,
                                                onClick = {
                                                    if (order.isPaid) {
                                                        viewModel.printReceipt(order)
                                                    } else {
                                                        viewModel.resumeOrder(order, onBack)
                                                    }
                                                },
                                                onPrint = {
                                                    if (order.isPaid) viewModel.printReceipt(order)
                                                }
                                            )
                                        }
                                    }
                                    if (rowOrders.size == 1) {
                                        Box(modifier = Modifier.weight(1f))
                                    }
                                }
                            }
                        }
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
                    title = { Text(stringResource(R.string.programmed_orders)) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        }
                    }
                )
            }
        ) { padding -> content(Modifier.padding(padding)) }
    }
}

@Composable
private fun ProgrammedDayHeader(group: ProgrammedDayGroup) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(PosShapes.Medium)
            .background(posUiColors().surface)
            .border(1.dp, posUiColors().border, PosShapes.Medium)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Text(
            group.dayLabel,
            color = posUiColors().textPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            maxLines = 2
        )
        Text(
            stringResource(R.string.programmed_orders_count, group.orders.size),
            color = posUiColors().textSecondary,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 2.dp)
        )
    }
}

@Composable
private fun ProgrammedOrderCardView(
    order: ProgrammedOrderCard,
    currencySymbol: String,
    onClick: () -> Unit,
    onPrint: () -> Unit
) {
    val headerColor = when (order.fulfillmentType) {
        FulfillmentType.DELIVERY -> PosColors.Warning
        FulfillmentType.PICKUP -> PosColors.Info
        FulfillmentType.DINE_IN -> PosColors.Success
        FulfillmentType.WALK_IN -> when (order.serviceType) {
            ServiceType.DINE_IN -> PosColors.Success
            ServiceType.TAKEAWAY -> PosColors.Info
        }
    }
    val typeLabel = when (order.fulfillmentType) {
        FulfillmentType.PICKUP -> stringResource(R.string.pickup)
        FulfillmentType.DELIVERY -> stringResource(R.string.delivery)
        else -> order.serviceType.displayName
    }
    val paidColor = if (order.isPaid) PosColors.Success else PosColors.Danger
    val paidLabel = if (order.isPaid) stringResource(R.string.paid) else stringResource(R.string.not_paid)
    val scheduleLabel = ScheduledOrderDateFormat.formatDateTime(order.pickupTimeMs)
    val timeLabel = ScheduledOrderDateFormat.formatTime(order.pickupTimeMs)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(188.dp)
            .clip(PosShapes.Card)
            .border(1.dp, posUiColors().border, PosShapes.Card)
            .background(posUiColors().surface)
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(headerColor)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(timeLabel, color = PosColors.TextOnPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text("#${order.orderNumber}", color = PosColors.TextOnPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    scheduleLabel,
                    color = PosColors.Warning,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(typeLabel, color = posUiColors().textSecondary, fontSize = 11.sp)
                    Surface(color = paidColor.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                        Text(
                            paidLabel,
                            color = paidColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Text(
                    text = formatMoney(order.total, currencySymbol),
                    color = posUiColors().textPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                )
                order.customerLabel?.let { label ->
                    Text(
                        label,
                        color = posUiColors().textSecondary,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(order.statusLabel, color = PosColors.Teal700, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.order_items_count, order.itemCount), color = posUiColors().textMuted, fontSize = 11.sp)
            }
            if (order.source == ProgrammedOrderSource.TRANSACTION) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(posUiColors().surfaceSubtle)
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Surface(
                        modifier = Modifier
                            .size(34.dp)
                            .clickable(onClick = onPrint),
                        shape = PosShapes.Small,
                        color = posUiColors().primarySubtle
                    ) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Icon(Icons.Default.Print, contentDescription = null, tint = PosColors.Primary, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
