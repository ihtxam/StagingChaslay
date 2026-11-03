package com.chaslay.pos.ui.reports
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.EodStaffSummaryRow
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import java.util.Locale

@Immutable
internal data class ReportDashPalette(
    val SurfaceDeep: Color,
    val SurfaceDeeper: Color,
    val HairlineLight: Color,
    val HairlineSoft: Color,
    val Accent: Color,
    val OnAccent: Color,
    val TextPrimary: Color,
    val TextSecondary: Color,
    val TextMuted: Color,
    val Success: Color,
    val Warning: Color,
    val Danger: Color,
    val Info: Color,
)

@Composable
@ReadOnlyComposable
internal fun reportDashColors(): ReportDashPalette {
    val ui = posUiColors()
    val scheme = MaterialTheme.colorScheme
    return ReportDashPalette(
        SurfaceDeep = ui.canvas,
        SurfaceDeeper = ui.surface,
        HairlineLight = ui.border,
        HairlineSoft = ui.surfaceMuted,
        Accent = scheme.primary,
        OnAccent = scheme.onPrimary,
        TextPrimary = ui.textPrimary,
        TextSecondary = ui.textSecondary,
        TextMuted = ui.textMuted,
        Success = PosColors.Success,
        Warning = PosColors.Warning,
        Danger = PosColors.Danger,
        Info = PosColors.Info,
    )
}

internal val ReportMonoFont = FontFamily.Monospace

internal data class ReportBreakdownRow(val label: String, val count: Int, val total: Double)

internal data class ReportTaxRow(
    val orderTypeLabel: String,
    val rate: Double,
    val net: Double,
    val tax: Double,
    val gross: Double
)

internal data class ReportTopProduct(
    val name: String,
    val category: String?,
    val qty: Int,
    val revenue: Double
)

@Composable
internal fun ReportKpiCard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    accent: Color,
    label: String,
    value: String,
    muted: Boolean = false,
) {
    Column(
        modifier = modifier
            .clip(PosShapes.Card)
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, PosShapes.Card)
            .padding(16.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(accent.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.size(10.dp))
        Text(
            label,
            color = reportDashColors().TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
        )
        Spacer(Modifier.size(4.dp))
        Text(
            value,
            color = if (muted) reportDashColors().TextMuted else reportDashColors().TextPrimary,
            fontSize = 19.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = ReportMonoFont,
        )
    }
}

@Composable
internal fun ReportBreakdownCard(
    title: String,
    icon: ImageVector,
    accent: Color,
    rows: List<ReportBreakdownRow>,
    sym: String,
) {
    val total = rows.sumOf { it.total }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(title, color = reportDashColors().TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        if (rows.isEmpty()) {
            Text(
                stringResource(R.string.report_no_data),
                color = reportDashColors().TextMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        } else {
            rows.forEach { row ->
                val pct = if (total > 0.0) (row.total / total * 100.0) else 0.0
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        row.label,
                        color = reportDashColors().TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${"%.1f".format(Locale.US, pct)}%",
                        color = accent,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Spacer(Modifier.size(10.dp))
                    if (row.count > 0) {
                        Text(
                            "${row.count}×",
                            color = reportDashColors().TextSecondary,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = ReportMonoFont,
                        )
                        Spacer(Modifier.size(10.dp))
                    }
                    Text(
                        reportMoney(sym, row.total),
                        color = reportDashColors().TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = ReportMonoFont,
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(reportDashColors().HairlineSoft),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (pct / 100.0).coerceIn(0.0, 1.0).toFloat())
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(accent),
                    )
                }
                Spacer(Modifier.size(4.dp))
            }
            Spacer(Modifier.size(4.dp))
            ReportHairlineDivider()
            Spacer(Modifier.size(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "TOTAL",
                    color = reportDashColors().TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    reportMoney(sym, total),
                    color = reportDashColors().TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = ReportMonoFont,
                )
            }
        }
    }
}

@Composable
internal fun ReportTaxBreakdownCard(rows: List<ReportTaxRow>, sym: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                androidx.compose.material.icons.Icons.Outlined.LocalOffer,
                contentDescription = null,
                tint = reportDashColors().Info,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.size(8.dp))
            Text(
                stringResource(R.string.report_tax_breakdown),
                color = reportDashColors().TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
        Spacer(Modifier.size(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Text("TYPE", color = reportDashColors().TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1.4f))
            Text("NET", color = reportDashColors().TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("TAX", color = reportDashColors().TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("GROSS", color = reportDashColors().TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.size(8.dp))
        rows.forEach { r ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1.4f)) {
                    Text(r.orderTypeLabel, color = reportDashColors().TextPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold)
                    Text("${"%.1f".format(Locale.US, r.rate)}%", color = reportDashColors().TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(reportMoney(sym, r.net), color = reportDashColors().TextPrimary, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(reportMoney(sym, r.tax), color = reportDashColors().Info, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(reportMoney(sym, r.gross), color = reportDashColors().TextPrimary, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
internal fun ReportTopProductRow(item: ReportTopProduct, sym: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.name, color = reportDashColors().TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
            item.category?.let {
                Text(it, color = reportDashColors().TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Text("${item.qty}×", color = reportDashColors().TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = ReportMonoFont)
        Spacer(Modifier.size(16.dp))
        Text(reportMoney(sym, item.revenue), color = reportDashColors().Success, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = ReportMonoFont)
    }
}

@Composable
internal fun ReportRefundRow(
    orderNumber: String,
    amount: Double,
    reason: String?,
    sym: String,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(reportDashColors().Danger.copy(alpha = 0.06f))
            .border(1.dp, reportDashColors().Danger.copy(alpha = 0.18f), RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                orderNumber,
                color = reportDashColors().TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f),
            )
            Text(
                "-${reportMoney(sym, amount)}",
                color = reportDashColors().Danger,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = ReportMonoFont,
            )
        }
        reason?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = reportDashColors().TextSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
internal fun ReportHairlineDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(reportDashColors().HairlineSoft),
    )
}

internal fun reportMoney(sym: String, value: Double): String =
    "$sym ${"%.2f".format(Locale.US, value)}"

@Composable
internal fun ReportStaffEodBreakdownCard(
    title: String,
    icon: ImageVector,
    accent: Color,
    rows: List<EodStaffSummaryRow>,
    sym: String,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(title, color = reportDashColors().TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        if (rows.isEmpty()) {
            Text(
                stringResource(R.string.report_no_data),
                color = reportDashColors().TextMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
        } else {
            val cashLabel = stringResource(R.string.cash)
            val cardLabel = stringResource(R.string.card)
            val tapLabel = stringResource(R.string.tap_to_pay_method)
            rows.forEach { row ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            row.name,
                            color = reportDashColors().TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            "${row.salesCount}× · ${reportMoney(sym, row.revenue)}",
                            color = reportDashColors().TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = ReportMonoFont,
                        )
                    }
                }
                if (row.cashTotal > 0.001) {
                    StaffPaymentSubRow(cashLabel, row.cashTotal, sym)
                }
                if (row.cardTotal > 0.001) {
                    StaffPaymentSubRow(cardLabel, row.cardTotal, sym)
                }
                if (row.tapToPayTotal > 0.001) {
                    StaffPaymentSubRow(tapLabel, row.tapToPayTotal, sym)
                }
                if (row.otherTotal > 0.001) {
                    StaffPaymentSubRow(stringResource(R.string.eod_staff_other_payments), row.otherTotal, sym)
                }
                Spacer(Modifier.size(6.dp))
            }
        }
    }
}

@Composable
private fun StaffPaymentSubRow(label: String, amount: Double, sym: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 8.dp, top = 2.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = reportDashColors().TextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Text(
            reportMoney(sym, amount),
            color = reportDashColors().TextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = ReportMonoFont,
        )
    }
}

@Composable
internal fun ReportScopedStaffPaymentsCard(
    cashTotal: Double,
    cardTotal: Double,
    tapToPayTotal: Double,
    otherTotal: Double,
    sym: String,
) {
    val cashLabel = stringResource(R.string.cash)
    val cardLabel = stringResource(R.string.card)
    val tapLabel = stringResource(R.string.tap_to_pay_method)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(reportDashColors().SurfaceDeeper)
            .border(1.dp, reportDashColors().HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Text(
            stringResource(R.string.eod_staff_my_payments_title),
            color = reportDashColors().TextPrimary,
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Spacer(Modifier.size(8.dp))
        if (cashTotal > 0.001) StaffPaymentSubRow(cashLabel, cashTotal, sym)
        if (cardTotal > 0.001) StaffPaymentSubRow(cardLabel, cardTotal, sym)
        if (tapToPayTotal > 0.001) StaffPaymentSubRow(tapLabel, tapToPayTotal, sym)
        if (otherTotal > 0.001) {
            StaffPaymentSubRow(stringResource(R.string.eod_staff_other_payments), otherTotal, sym)
        }
    }
}
