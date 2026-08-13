package com.chaslay.pos.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AttachMoney
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.EndOfDayReport
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun EndOfDayReportScreen(
    report: EndOfDayReport,
    currencySymbol: String,
    onPrint: () -> Unit,
    modifier: Modifier = Modifier,
    staffOptions: List<EodStaffOption> = emptyList(),
    selectedStaffId: Long? = null,
    onStaffSelected: (Long?) -> Unit = {},
) {
    val paymentRows = remember(report.paymentRows) {
        report.paymentRows
            .filter { it.amount > 0.0 }
            .map { ReportBreakdownRow(it.label, 0, it.amount) }
    }
    val orderTypeRows = remember(report.orderTypeRows) {
        report.orderTypeRows.map { ReportBreakdownRow(it.label, it.count, it.amount) }
    }
    val taxRows = remember(report.vatRows) {
        report.vatRows.map { ReportTaxRow(it.label, it.rate, it.net, it.tva, it.brut) }
    }
    val topProducts = remember(report.productsSold) {
        report.productsSold.map { ReportTopProduct(it.productName, null, it.quantitySold, it.revenue) }
    }
    val periodLabel = remember(report.periodStart, report.periodEnd) {
        formatPeriod(report.periodStart, report.periodEnd)
    }

    Column(modifier = modifier.fillMaxSize()) {
        EndOfDayHeader(onPrint = onPrint)
        if (staffOptions.isNotEmpty()) {
            EodStaffSelector(
                options = staffOptions,
                selectedStaffId = selectedStaffId,
                onSelected = onStaffSelected,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
            )
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (periodLabel.isNotBlank()) {
                item {
                    Text(
                        periodLabel,
                        color = ReportDashColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            item { EndOfDayKpiGrid(report = report, sym = currencySymbol) }
            if (taxRows.isNotEmpty()) {
                item { ReportTaxBreakdownCard(rows = taxRows, sym = currencySymbol) }
            }
            item {
                ReportBreakdownCard(
                    title = "Payment Methods",
                    icon = Icons.Outlined.CreditCard,
                    accent = ReportDashColors.Info,
                    rows = paymentRows,
                    sym = currencySymbol,
                )
            }
            item {
                ReportBreakdownCard(
                    title = "Order Types",
                    icon = Icons.Outlined.PointOfSale,
                    accent = ReportDashColors.Success,
                    rows = orderTypeRows,
                    sym = currencySymbol,
                )
            }
            if (report.refundTotal > 0.0) {
                item {
                    RefundsCard(
                        refundTotal = report.refundTotal,
                        refundCount = report.refundCount,
                        refundedOrders = report.refundedOrders,
                        sym = currencySymbol,
                    )
                }
            }
            if (topProducts.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.products_sold),
                        color = ReportDashColors.TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                item {
                    Text(
                        "${stringResource(R.string.total_products_sold)}: ${topProducts.sumOf { it.qty }}",
                        color = ReportDashColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                items(topProducts) { product ->
                    ReportTopProductRow(item = product, sym = currencySymbol)
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun EodStaffSelector(
    options: List<EodStaffOption>,
    selectedStaffId: Long?,
    onSelected: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            val selected = option.userId == selectedStaffId
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (selected) ReportDashColors.Accent else ReportDashColors.SurfaceDeeper)
                    .border(
                        1.dp,
                        if (selected) ReportDashColors.Accent else ReportDashColors.HairlineLight,
                        RoundedCornerShape(10.dp),
                    )
                    .clickable { onSelected(option.userId) }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Text(
                    option.name,
                    color = if (selected) ReportDashColors.OnAccent else ReportDashColors.TextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun EndOfDayHeader(onPrint: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.end_of_day),
            color = ReportDashColors.TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(ReportDashColors.Accent)
                .clickable(onClick = onPrint)
                .padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Print, contentDescription = null, tint = ReportDashColors.OnAccent, modifier = Modifier.size(15.dp))
            Spacer(Modifier.size(6.dp))
            Text(
                stringResource(R.string.print_end_of_day).uppercase(Locale.getDefault()),
                color = ReportDashColors.OnAccent,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.3.sp,
            )
        }
    }
}

@Composable
private fun EndOfDayKpiGrid(report: EndOfDayReport, sym: String) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = ReportDashColors.Success,
                label = "BRUT TOTAL",
                value = reportMoney(sym, report.brutTotal),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.Receipt,
                accent = ReportDashColors.Info,
                label = "ORDERS",
                value = report.salesCount.toString(),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.LocalOffer,
                accent = ReportDashColors.Info,
                label = "TVA",
                value = reportMoney(sym, report.taxTotal),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = ReportDashColors.Accent,
                label = "NET",
                value = reportMoney(sym, report.netTotal),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.CardGiftcard,
                accent = ReportDashColors.Warning,
                label = "TIPS",
                value = reportMoney(sym, report.tipsTotal),
                muted = report.tipsTotal == 0.0,
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.Undo,
                accent = ReportDashColors.Danger,
                label = "REFUNDS",
                value = reportMoney(sym, report.refundTotal),
                muted = report.refundTotal == 0.0,
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = ReportDashColors.Success,
                label = "REVENUE",
                value = reportMoney(sym, report.revenue),
            )
            if (report.tipsTotal > 0.0) {
                ReportKpiCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Outlined.TrendingUp,
                    accent = ReportDashColors.Accent,
                    label = "GRAND TOTAL",
                    value = reportMoney(sym, report.grandTotal),
                )
            } else {
                report.coversServed?.let { covers ->
                    ReportKpiCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.PointOfSale,
                        accent = ReportDashColors.Warning,
                        label = stringResource(R.string.covers_served).uppercase(Locale.getDefault()),
                        value = covers.toString(),
                    )
                }
            }
        }
        if (report.tipsTotal > 0.0 && report.coversServed != null) {
            Row(modifier = Modifier.fillMaxWidth()) {
                ReportKpiCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Outlined.PointOfSale,
                    accent = ReportDashColors.Warning,
                    label = stringResource(R.string.covers_served).uppercase(Locale.getDefault()),
                    value = report.coversServed.toString(),
                )
                Spacer(Modifier.weight(3f))
            }
        }
    }
}

@Composable
private fun RefundsCard(
    refundTotal: Double,
    refundCount: Int,
    refundedOrders: List<com.chaslay.pos.domain.model.RefundedOrderRow>,
    sym: String,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(ReportDashColors.SurfaceDeeper)
            .border(1.dp, ReportDashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Undo, contentDescription = null, tint = ReportDashColors.Danger, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text("Refunds", color = ReportDashColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(stringResource(R.string.refunds_total), color = ReportDashColors.TextSecondary, fontSize = 11.sp)
                Text(
                    reportMoney(sym, refundTotal),
                    color = ReportDashColors.Danger,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = ReportMonoFont,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.refunds_count), color = ReportDashColors.TextSecondary, fontSize = 11.sp)
                Text(
                    refundCount.toString(),
                    color = ReportDashColors.TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = ReportMonoFont,
                )
            }
        }
        refundedOrders.forEach { row ->
            ReportRefundRow(
                orderNumber = row.orderNumber,
                amount = row.refundAmount,
                reason = row.refundReason,
                sym = sym,
            )
        }
    }
}

private fun formatPeriod(start: Long, end: Long): String {
    if (start <= 0L || end <= 0L) return ""
    val fmt = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
    return "${fmt.format(Date(start))} – ${fmt.format(Date(end - 1))}"
}
