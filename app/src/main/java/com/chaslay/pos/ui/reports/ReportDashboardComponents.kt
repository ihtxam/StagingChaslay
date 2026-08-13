package com.chaslay.pos.ui.reports

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

internal object ReportDashColors {
    val SurfaceDeep = Color(0xFFF7F7F7)
    val SurfaceDeeper = Color(0xFFFFFFFF)
    val HairlineLight = Color(0x1A000000)
    val HairlineSoft = Color(0x0F000000)
    val Accent = Color(0xFF13A99A)
    val OnAccent = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF121826)
    val TextSecondary = Color(0xFF556377)
    val TextMuted = Color(0xFF8896A8)
    val Success = Color(0xFF1F8F55)
    val Warning = Color(0xFFB8862F)
    val Danger = Color(0xFFD64545)
    val Info = Color(0xFF3477D1)
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
            .clip(RoundedCornerShape(14.dp))
            .background(ReportDashColors.SurfaceDeeper)
            .border(1.dp, ReportDashColors.HairlineLight, RoundedCornerShape(14.dp))
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
            color = ReportDashColors.TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
        )
        Spacer(Modifier.size(4.dp))
        Text(
            value,
            color = if (muted) ReportDashColors.TextMuted else ReportDashColors.TextPrimary,
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
            .background(ReportDashColors.SurfaceDeeper)
            .border(1.dp, ReportDashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(title, color = ReportDashColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        if (rows.isEmpty()) {
            Text("No data", color = ReportDashColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
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
                        color = ReportDashColors.TextPrimary,
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
                            color = ReportDashColors.TextSecondary,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = ReportMonoFont,
                        )
                        Spacer(Modifier.size(10.dp))
                    }
                    Text(
                        reportMoney(sym, row.total),
                        color = ReportDashColors.TextPrimary,
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
                        .background(ReportDashColors.HairlineSoft),
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
                    color = ReportDashColors.TextSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    reportMoney(sym, total),
                    color = ReportDashColors.TextPrimary,
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
            .background(ReportDashColors.SurfaceDeeper)
            .border(1.dp, ReportDashColors.HairlineLight, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                androidx.compose.material.icons.Icons.Outlined.LocalOffer,
                contentDescription = null,
                tint = ReportDashColors.Info,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.size(8.dp))
            Text("Tax Breakdown", color = ReportDashColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.size(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Text("TYPE", color = ReportDashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1.4f))
            Text("NET", color = ReportDashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("TAX", color = ReportDashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
            Text("GROSS", color = ReportDashColors.TextMuted, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.weight(1f))
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
                    Text(r.orderTypeLabel, color = ReportDashColors.TextPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold)
                    Text("${"%.1f".format(Locale.US, r.rate)}%", color = ReportDashColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(reportMoney(sym, r.net), color = ReportDashColors.TextPrimary, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(reportMoney(sym, r.tax), color = ReportDashColors.Info, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text(reportMoney(sym, r.gross), color = ReportDashColors.TextPrimary, fontSize = 12.5.sp, fontFamily = ReportMonoFont, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
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
            .background(ReportDashColors.SurfaceDeeper)
            .border(1.dp, ReportDashColors.HairlineLight, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(item.name, color = ReportDashColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
            item.category?.let {
                Text(it, color = ReportDashColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Text("${item.qty}×", color = ReportDashColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = ReportMonoFont)
        Spacer(Modifier.size(16.dp))
        Text(reportMoney(sym, item.revenue), color = ReportDashColors.Success, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = ReportMonoFont)
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
            .background(ReportDashColors.Danger.copy(alpha = 0.06f))
            .border(1.dp, ReportDashColors.Danger.copy(alpha = 0.18f), RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                orderNumber,
                color = ReportDashColors.TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.weight(1f),
            )
            Text(
                "-${reportMoney(sym, amount)}",
                color = ReportDashColors.Danger,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = ReportMonoFont,
            )
        }
        reason?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = ReportDashColors.TextSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
internal fun ReportHairlineDivider() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(ReportDashColors.HairlineSoft),
    )
}

internal fun reportMoney(sym: String, value: Double): String =
    "$sym ${"%.2f".format(Locale.US, value)}"
