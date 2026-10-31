package com.chaslay.pos.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.ui.reports.ProfitMarginSnapshot
import com.chaslay.pos.ui.reports.ProfitMarginRow
import com.chaslay.pos.ui.reports.ProfitBreakdown
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.formatMoneyAmount
import java.util.Locale

@Composable
fun ReportsScreen(viewModel: ReportsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val currency by viewModel.currencySymbol.collectAsStateWithLifecycle()
    var tab by remember { mutableIntStateOf(0) }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.end_of_day)) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.sales_report)) })
            Tab(selected = tab == 2, onClick = { tab = 2 }, text = { Text(stringResource(R.string.product_sales)) })
            Tab(selected = tab == 3, onClick = { tab = 3 }, text = { Text(stringResource(R.string.user_performance)) })
            Tab(selected = tab == 4, onClick = { tab = 4 }, text = { Text(stringResource(R.string.reports_tab_profit)) })
        }

        when (tab) {
            0 -> EndOfDayReportScreen(
                report = state.endOfDayReport,
                currencySymbol = currency,
                onPrint = viewModel::printEndOfDayReport,
                includeProductsOnPrint = state.eodIncludeProductsSold,
                onIncludeProductsOnPrintChange = viewModel::setEodIncludeProductsSold,
                includeStaffBreakdownOnPrint = state.eodIncludeStaffBreakdown,
                onIncludeStaffBreakdownOnPrintChange = viewModel::setEodIncludeStaffBreakdown,
                showStaffBreakdownToggle = state.canViewAllSales && state.selectedEodStaffId == null,
                eodDayPreset = state.eodDayPreset,
                eodCustomDayStartMs = state.eodCustomDayStartMs,
                onEodDayPresetSelected = viewModel::selectEodDayPreset,
                onEodCustomDaySelected = viewModel::selectEodCustomDay,
                staffOptions = if (state.canViewAllSales) state.eodStaffOptions else emptyList(),
                selectedStaffId = state.selectedEodStaffId,
                onStaffSelected = viewModel::selectEodStaff,
                modifier = Modifier.weight(1f),
            )
            1 -> SalesReportV5Screen(
                state = state,
                currencySymbol = currency,
                onRangeSelected = viewModel::selectRange,
                onRefresh = viewModel::refresh,
                onPrint = viewModel::printSalesReport,
                modifier = Modifier.weight(1f)
            )
            2 -> ProductSalesTab(state.topProducts, currency)
            3 -> UserPerformanceTab(state.userPerformance, currency)
            4 -> ProfitMarginTab(
                state = state,
                currency = currency,
                onRangeSelected = viewModel::selectRange,
                onBreakdownSelected = viewModel::selectProfitBreakdown
            )
        }
    }
}

@Composable
private fun SalesReportTab(
    state: ReportsUiState,
    currency: String,
    onRangeSelected: (ReportRange) -> Unit,
    onPrintReport: () -> Unit
) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.sales_report), fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Button(onClick = onPrintReport) {
                Text(stringResource(R.string.print_report))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                ReportRange.TODAY to stringResource(R.string.today),
                ReportRange.YESTERDAY to stringResource(R.string.yesterday),
                ReportRange.LAST_WEEK to stringResource(R.string.last_week),
                ReportRange.LAST_MONTH to stringResource(R.string.last_month)
            ).forEach { (range, label) ->
                FilterChip(
                    selected = state.selectedRange == range,
                    onClick = { onRangeSelected(range) },
                    label = { Text(label) }
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.gross_sales), formatMoney(state.salesReport.grossSales, currency), Color(0xFF27AE60), Modifier.weight(1f))
            KpiCard(stringResource(R.string.net_sales), formatMoney(state.salesReport.netSales, currency), Color(0xFF16A085), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.average_ticket), formatMoney(state.salesReport.averageTicket, currency), Color(0xFF3498DB), Modifier.weight(1f))
            KpiCard(stringResource(R.string.transactions), state.salesReport.orderCount.toString(), Color(0xFF8E44AD), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.cancelled_orders), "${state.salesReport.cancelledCount} · ${formatMoney(state.salesReport.cancelledTotal, currency)}", Color(0xFFE74C3C), Modifier.weight(1f))
            KpiCard(stringResource(R.string.total_tips), formatMoney(state.salesReport.totalTips, currency), Color(0xFFE67E22), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            KpiCard(stringResource(R.string.tax), formatMoney(state.salesReport.taxTotal, currency), Color(0xFF9B59B6), Modifier.weight(1f))
            Spacer(Modifier.weight(1f))
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.report_payment_distribution).uppercase(),
                    fontSize = 11.sp,
                    color = Color.Gray,
                    fontWeight = FontWeight.Bold
                )
                PaymentBar(stringResource(R.string.cash), state.salesReport.cashTotal, state.salesReport.grossSales, Color(0xFFE67E22), currency)
                PaymentBar(stringResource(R.string.card), state.salesReport.cardTotal, state.salesReport.grossSales, Color(0xFF27AE60), currency)
                ReportRow(stringResource(R.string.tax), formatMoney(state.salesReport.taxTotal, currency))
                ReportRow(
                    stringResource(R.string.dine_in_vat_rate),
                    "${state.salesReport.dineInVatRate}% · ${state.salesReport.dineInCount} · ${formatMoney(state.salesReport.dineInTotal, currency)}"
                )
                ReportRow(
                    stringResource(R.string.takeaway_vat_rate),
                    "${state.salesReport.takeawayVatRate}% · ${state.salesReport.takeawayCount} · ${formatMoney(state.salesReport.takeawayTotal, currency)}"
                )
            }
        }
    }
}

@Composable
private fun KpiCard(title: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .height(40.dp)
                    .padding(end = 10.dp)
                    .fillMaxWidth(0.02f)
                    .background(accent, RoundedCornerShape(2.dp))
            )
            Column {
                Text(title, fontSize = 11.sp, color = Color.Gray)
                Text(value, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
        }
    }
}

@Composable
private fun PaymentBar(label: String, amount: Double, total: Double, color: Color, currency: String) {
    val fraction = if (total <= 0) 0f else (amount / total).toFloat().coerceIn(0f, 1f)
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label)
            Text(formatMoney(amount, currency))
        }
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction)
                .height(8.dp)
                .background(color, RoundedCornerShape(4.dp))
        )
    }
}

@Composable
private fun DailySalesTab(state: ReportsUiState, currency: String) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ReportRow(stringResource(R.string.transactions), state.dailyReport.salesCount.toString())
        ReportRow(stringResource(R.string.today_sales), formatMoney(state.dailyReport.revenue, currency))
        ReportRow(stringResource(R.string.tax), formatMoney(state.dailyReport.tax, currency))
        ReportRow(stringResource(R.string.cash_revenue), formatMoney(state.dailyReport.cashTotal, currency))
        ReportRow(stringResource(R.string.card_revenue), formatMoney(state.dailyReport.cardTotal, currency))
    }
}

@Composable
private fun ProductSalesTab(products: List<com.chaslay.pos.domain.model.ProductSalesReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products) { product ->
            ReportRow(product.productName, "${product.quantitySold} · ${formatMoney(product.revenue, currency)}")
        }
    }
}

@Composable
private fun UserPerformanceTab(users: List<com.chaslay.pos.domain.model.UserPerformanceReport>, currency: String) {
    LazyColumn(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(users) { user ->
            Column(modifier = Modifier.padding(vertical = 4.dp)) {
                ReportRow(user.userName, "${user.transactionCount} · ${formatMoney(user.revenue, currency)}")
                if (user.cashTotal > 0.001) {
                    ReportRow("  ${stringResource(R.string.cash)}", formatMoney(user.cashTotal, currency))
                }
                if (user.cardTotal > 0.001) {
                    ReportRow("  ${stringResource(R.string.card)}", formatMoney(user.cardTotal, currency))
                }
                if (user.tapToPayTotal > 0.001) {
                    ReportRow(
                        "  ${stringResource(R.string.tap_to_pay_method)}",
                        formatMoney(user.tapToPayTotal, currency)
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfitMarginTab(
    state: ReportsUiState,
    currency: String,
    onRangeSelected: (ReportRange) -> Unit,
    onBreakdownSelected: (ProfitBreakdown) -> Unit
) {
    val profit = state.profitReport.summary
    val rows = when (state.profitBreakdown) {
        ProfitBreakdown.CATEGORY -> state.profitReport.byCategory
        ProfitBreakdown.PRODUCT -> state.profitReport.byProduct
        ProfitBreakdown.DAY -> state.profitReport.byDay
        ProfitBreakdown.MONTH -> state.profitReport.byMonth
    }
    val uncategorized = stringResource(R.string.reports_profit_uncategorized)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(stringResource(R.string.reports_tab_profit), fontWeight = FontWeight.Bold, fontSize = 22.sp)

        Text(
            text = stringResource(
                if (state.profitReport.fromCloud) R.string.reports_profit_cloud_source
                else R.string.reports_profit_cloud_source_local_fallback
            ),
            fontSize = 12.sp,
            color = Color.Gray
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                ReportRange.TODAY to stringResource(R.string.today),
                ReportRange.YESTERDAY to stringResource(R.string.yesterday),
                ReportRange.LAST_WEEK to stringResource(R.string.last_week),
                ReportRange.LAST_MONTH to stringResource(R.string.last_month)
            ).forEach { (range, label) ->
                FilterChip(
                    selected = state.selectedRange == range,
                    onClick = { onRangeSelected(range) },
                    label = { Text(label) }
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                KpiCard(
                    stringResource(R.string.reports_profit_net_merchandise),
                    formatMoney(profit.netMerchandise, currency),
                    Color(0xFF3498DB),
                    Modifier.fillMaxWidth()
                )
                profit.revenueChangePct?.let { pct ->
                    Text(
                        stringResource(R.string.reports_profit_vs_prior, formatChangePct(pct)),
                        fontSize = 11.sp,
                        color = changePctColor(pct),
                        modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                    )
                }
            }
            KpiCard(
                stringResource(R.string.reports_profit_cogs),
                formatMoney(profit.cogs, currency),
                Color(0xFFE67E22),
                Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                KpiCard(
                    stringResource(R.string.reports_profit_gross),
                    formatMoney(profit.grossProfit, currency),
                    Color(0xFF27AE60),
                    Modifier.fillMaxWidth()
                )
                profit.profitChangePct?.let { pct ->
                    Text(
                        stringResource(R.string.reports_profit_vs_prior, formatChangePct(pct)),
                        fontSize = 11.sp,
                        color = changePctColor(pct),
                        modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                    )
                }
            }
            KpiCard(
                stringResource(R.string.reports_profit_margin_pct),
                profit.marginPercent.takeIf { profit.netMerchandise > 0.0005 }?.let {
                    "${"%.1f".format(Locale.US, it)}%"
                } ?: "—",
                Color(0xFF16A085),
                Modifier.weight(1f)
            )
        }
        if (profit.linesMissingCost > 0) {
            Text(
                stringResource(R.string.reports_profit_missing_cost_hint, profit.linesMissingCost),
                fontSize = 12.sp,
                color = Color(0xFF92400E)
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                ProfitBreakdown.CATEGORY to stringResource(R.string.reports_profit_by_category),
                ProfitBreakdown.PRODUCT to stringResource(R.string.reports_profit_by_product),
                ProfitBreakdown.DAY to stringResource(R.string.reports_profit_by_day),
                ProfitBreakdown.MONTH to stringResource(R.string.reports_profit_by_month)
            ).forEach { (mode, label) ->
                FilterChip(
                    selected = state.profitBreakdown == mode,
                    onClick = { onBreakdownSelected(mode) },
                    label = { Text(label, maxLines = 1) }
                )
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        stringResource(R.string.reports_profit_col_name),
                        modifier = Modifier.weight(1.4f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray
                    )
                    Text(
                        stringResource(R.string.reports_profit_col_qty),
                        modifier = Modifier.weight(0.6f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                    Text(
                        stringResource(R.string.reports_profit_col_revenue),
                        modifier = Modifier.weight(1f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                    Text(
                        stringResource(R.string.reports_profit_cogs),
                        modifier = Modifier.weight(1f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                    Text(
                        stringResource(R.string.reports_profit_gross),
                        modifier = Modifier.weight(1f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                    Text(
                        stringResource(R.string.reports_profit_margin_pct),
                        modifier = Modifier.weight(0.55f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                    Text(
                        stringResource(R.string.reports_profit_col_vs_prior),
                        modifier = Modifier.weight(0.65f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Gray,
                        textAlign = TextAlign.End
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                if (rows.isEmpty()) {
                    Text(stringResource(R.string.reports_profit_empty), color = Color.Gray, fontSize = 13.sp)
                } else {
                    rows.take(80).forEach { row ->
                        ProfitMarginRowLine(row, currency, uncategorized)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfitMarginRowLine(row: ProfitMarginRow, currency: String, uncategorizedLabel: String) {
    val label = if (row.id == "uncategorized") uncategorizedLabel else row.label
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1.4f), fontSize = 13.sp, maxLines = 2)
        Text(
            formatQty(row.quantity),
            modifier = Modifier.weight(0.6f),
            fontSize = 13.sp,
            textAlign = TextAlign.End
        )
        Text(
            formatMoney(row.revenue, currency),
            modifier = Modifier.weight(1f),
            fontSize = 13.sp,
            textAlign = TextAlign.End
        )
        Text(
            formatMoney(row.cogs, currency),
            modifier = Modifier.weight(1f),
            fontSize = 13.sp,
            textAlign = TextAlign.End
        )
        Text(
            formatMoney(row.profit, currency),
            modifier = Modifier.weight(1f),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End
        )
        Text(
            row.marginPercent?.let { "${"%.1f".format(Locale.US, it)}%" } ?: "—",
            modifier = Modifier.weight(0.55f),
            fontSize = 13.sp,
            textAlign = TextAlign.End
        )
        Text(
            formatChangePct(row.profitChangePct),
            modifier = Modifier.weight(0.65f),
            fontSize = 13.sp,
            color = changePctColor(row.profitChangePct),
            textAlign = TextAlign.End
        )
    }
}

private fun formatChangePct(value: Double?): String {
    if (value == null || value.isNaN()) return "—"
    val sign = if (value > 0) "+" else ""
    return "$sign${"%.1f".format(Locale.US, value)}%"
}

@Composable
private fun changePctColor(value: Double?): Color {
    if (value == null || value.isNaN()) return Color.Gray
    return if (value >= 0) Color(0xFF047857) else Color(0xFFB91C1C)
}

private fun formatQty(qty: Double): String =
    if (qty == kotlin.math.floor(qty)) qty.toInt().toString()
    else String.format(Locale.US, "%.2f", qty)

@Composable
private fun ReportRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Text(value, fontWeight = FontWeight.SemiBold)
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
}

private fun formatMoney(amount: Double, symbol: String): String = formatMoneyAmount(amount, symbol)
