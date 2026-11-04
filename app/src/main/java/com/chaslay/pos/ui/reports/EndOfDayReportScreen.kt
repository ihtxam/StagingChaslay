package com.chaslay.pos.ui.reports
import com.chaslay.pos.ui.theme.posUiColors

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
import androidx.compose.foundation.layout.width
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
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import com.chaslay.pos.ui.theme.PosColors
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.roundMoney
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EndOfDayReportScreen(
    report: EndOfDayReport,
    currencySymbol: String,
    onPrint: () -> Unit,
    modifier: Modifier = Modifier,
    includeProductsOnPrint: Boolean = true,
    onIncludeProductsOnPrintChange: (Boolean) -> Unit = {},
    includeStaffBreakdownOnPrint: Boolean = false,
    onIncludeStaffBreakdownOnPrintChange: (Boolean) -> Unit = {},
    showStaffBreakdownToggle: Boolean = false,
    eodDayPreset: EodDayPreset = EodDayPreset.TODAY,
    eodCustomDayStartMs: Long = 0L,
    onEodDayPresetSelected: (EodDayPreset) -> Unit = {},
    onEodCustomDaySelected: (Long) -> Unit = {},
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

    Column(modifier = modifier.fillMaxSize().background(posUiColors().canvas)) {
        EndOfDayHeader(
            onPrint = onPrint,
            includeProductsOnPrint = includeProductsOnPrint,
            onIncludeProductsOnPrintChange = onIncludeProductsOnPrintChange,
            includeStaffBreakdownOnPrint = includeStaffBreakdownOnPrint,
            onIncludeStaffBreakdownOnPrintChange = onIncludeStaffBreakdownOnPrintChange,
            showStaffBreakdownToggle = showStaffBreakdownToggle,
        )
        EodDateAndStaffFilterRow(
            preset = eodDayPreset,
            customDayStartMs = eodCustomDayStartMs,
            onPresetSelected = onEodDayPresetSelected,
            onCustomDaySelected = onEodCustomDaySelected,
            staffOptions = staffOptions,
            selectedStaffId = selectedStaffId,
            onStaffSelected = onStaffSelected,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (periodLabel.isNotBlank()) {
                item {
                    Text(
                        periodLabel,
                        color = reportDashColors().TextSecondary,
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
                    accent = reportDashColors().Info,
                    rows = paymentRows,
                    sym = currencySymbol,
                )
            }
            if (orderTypeRows.isNotEmpty()) {
                item {
                    ReportBreakdownCard(
                        title = stringResource(R.string.eod_order_types_title),
                        icon = Icons.Outlined.PointOfSale,
                        accent = reportDashColors().Success,
                        rows = orderTypeRows,
                        sym = currencySymbol,
                    )
                }
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
                        color = reportDashColors().TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                item {
                    Text(
                        "${stringResource(R.string.total_products_sold)}: ${topProducts.sumOf { it.qty }}",
                        color = reportDashColors().TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                items(topProducts) { product ->
                    ReportTopProductRow(item = product, sym = currencySymbol)
                }
            }
            if (report.staffBreakdown.isNotEmpty() && selectedStaffId == null) {
                item {
                    ReportStaffEodBreakdownCard(
                        title = stringResource(R.string.eod_staff_breakdown_title),
                        icon = Icons.Outlined.PointOfSale,
                        accent = reportDashColors().Accent,
                        rows = report.staffBreakdown,
                        sym = currencySymbol,
                    )
                }
            }
            if (selectedStaffId != null) {
                item {
                    val cardCombined = report.cardTotal + report.adyenTotal
                    val other = (report.paymentRows.sumOf { it.amount } -
                        report.cashTotal - cardCombined - report.tapToPayTotal).coerceAtLeast(0.0)
                    ReportScopedStaffPaymentsCard(
                        cashTotal = report.cashTotal,
                        cardTotal = cardCombined,
                        tapToPayTotal = report.tapToPayTotal,
                        otherTotal = roundMoney(other),
                        sym = currencySymbol,
                    )
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun EodPrintSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 2.dp),
    ) {
        com.chaslay.pos.ui.theme.PosSwitch(checked = checked, onCheckedChange = onCheckedChange)
        Text(
            label,
            fontSize = 13.sp,
            color = reportDashColors().TextPrimary,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EodDateAndStaffFilterRow(
    preset: EodDayPreset,
    customDayStartMs: Long,
    onPresetSelected: (EodDayPreset) -> Unit,
    onCustomDaySelected: (Long) -> Unit,
    staffOptions: List<EodStaffOption>,
    selectedStaffId: Long?,
    onStaffSelected: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var datePickerOpen by remember { mutableStateOf(false) }
    val customLabel = remember(customDayStartMs) {
        if (customDayStartMs <= 0L) return@remember ""
        SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date(customDayStartMs))
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf(
            EodDayPreset.TODAY to stringResource(R.string.today),
            EodDayPreset.YESTERDAY to stringResource(R.string.yesterday),
        ).forEach { (dayPreset, label) ->
            val selected = preset == dayPreset
            EodChip(label = label, selected = selected) { onPresetSelected(dayPreset) }
        }
        val customSelected = preset == EodDayPreset.CUSTOM
        val pickLabel = if (customSelected && customLabel.isNotBlank()) {
            customLabel
        } else {
            stringResource(R.string.eod_pick_date)
        }
        EodChip(label = pickLabel, selected = customSelected) { datePickerOpen = true }
        if (staffOptions.isNotEmpty()) {
            Spacer(Modifier.width(4.dp))
            staffOptions.forEach { option ->
                val selected = option.userId == selectedStaffId
                EodChip(
                    label = if (option.userId == null) {
                        stringResource(R.string.eod_company_wide)
                    } else {
                        option.name
                    },
                    selected = selected,
                ) { onStaffSelected(option.userId) }
            }
        }
    }
    if (datePickerOpen) {
        val initialMs = when {
            customDayStartMs > 0L -> customDayStartMs
            preset == EodDayPreset.YESTERDAY -> {
                java.util.Calendar.getInstance().apply {
                    add(java.util.Calendar.DAY_OF_YEAR, -1)
                }.timeInMillis
            }
            else -> System.currentTimeMillis()
        }
        val state = rememberDatePickerState(initialSelectedDateMillis = initialMs)
        DatePickerDialog(
            onDismissRequest = { datePickerOpen = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onCustomDaySelected(it) }
                    datePickerOpen = false
                }) {
                    Text(stringResource(R.string.ok))
                }
            },
            dismissButton = {
                TextButton(onClick = { datePickerOpen = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        ) {
            DatePicker(state = state)
        }
    }
}

@Composable
private fun EodChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) reportDashColors().Accent else reportDashColors().SurfaceDeeper)
            .border(
                1.dp,
                if (selected) reportDashColors().Accent else reportDashColors().HairlineLight,
                RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (selected) reportDashColors().OnAccent else reportDashColors().TextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun EndOfDayHeader(
    onPrint: () -> Unit,
    includeProductsOnPrint: Boolean,
    onIncludeProductsOnPrintChange: (Boolean) -> Unit,
    includeStaffBreakdownOnPrint: Boolean,
    onIncludeStaffBreakdownOnPrintChange: (Boolean) -> Unit,
    showStaffBreakdownToggle: Boolean,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.end_of_day),
            color = reportDashColors().TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.weight(1f),
        )
        Row(
            modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            EodPrintSwitch(
                checked = includeProductsOnPrint,
                onCheckedChange = onIncludeProductsOnPrintChange,
                label = stringResource(R.string.eod_include_products_on_print),
            )
            if (showStaffBreakdownToggle) {
                EodPrintSwitch(
                    checked = includeStaffBreakdownOnPrint,
                    onCheckedChange = onIncludeStaffBreakdownOnPrintChange,
                    label = stringResource(R.string.eod_include_staff_on_print),
                )
            }
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(reportDashColors().Accent)
                    .clickable(onClick = onPrint)
                    .padding(horizontal = 14.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Print, contentDescription = null, tint = reportDashColors().OnAccent, modifier = Modifier.size(15.dp))
                Spacer(Modifier.size(6.dp))
                Text(
                    stringResource(R.string.print_end_of_day).uppercase(Locale.getDefault()),
                    color = reportDashColors().OnAccent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.3.sp,
                )
            }
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
                accent = reportDashColors().Success,
                label = "BRUT TOTAL",
                value = reportMoney(sym, report.brutTotal),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.Receipt,
                accent = reportDashColors().Info,
                label = "ORDERS",
                value = report.salesCount.toString(),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.LocalOffer,
                accent = reportDashColors().Info,
                label = "TVA",
                value = reportMoney(sym, report.taxTotal),
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = reportDashColors().Accent,
                label = "NET",
                value = reportMoney(sym, report.netTotal),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.CardGiftcard,
                accent = reportDashColors().Warning,
                label = "TIPS",
                value = reportMoney(sym, report.tipsTotal),
                muted = report.tipsTotal == 0.0,
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.Undo,
                accent = reportDashColors().Danger,
                label = "REFUNDS",
                value = reportMoney(sym, report.refundTotal),
                muted = report.refundTotal == 0.0,
            )
            ReportKpiCard(
                modifier = Modifier.weight(1f),
                icon = Icons.Outlined.AttachMoney,
                accent = reportDashColors().Success,
                label = "REVENUE",
                value = reportMoney(sym, report.revenue),
            )
            if (report.tipsTotal > 0.0) {
                ReportKpiCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Outlined.TrendingUp,
                    accent = reportDashColors().Accent,
                    label = "GRAND TOTAL",
                    value = reportMoney(sym, report.grandTotal),
                )
            } else {
                report.coversServed?.let { covers ->
                    ReportKpiCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.PointOfSale,
                        accent = reportDashColors().Warning,
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
                    accent = reportDashColors().Warning,
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
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Undo, contentDescription = null, tint = reportDashColors().Danger, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(
                stringResource(R.string.report_refunds),
                color = reportDashColors().TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text(stringResource(R.string.refunds_total), color = reportDashColors().TextSecondary, fontSize = 11.sp)
                Text(
                    reportMoney(sym, refundTotal),
                    color = reportDashColors().Danger,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = ReportMonoFont,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.refunds_count), color = reportDashColors().TextSecondary, fontSize = 11.sp)
                Text(
                    refundCount.toString(),
                    color = reportDashColors().TextPrimary,
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
