package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Scale
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.scale.AclasScaleProtocol
import com.chaslay.pos.scale.AclasScaleReading
import com.chaslay.pos.scale.AclasScaleStatus
import com.chaslay.pos.scale.ScaleWedgeParser
import com.chaslay.pos.ui.scanner.ScaleWedgeHub
import com.chaslay.pos.ui.theme.VectronColors
import java.util.Locale
import kotlin.math.roundToInt

private enum class WeightEntryUnit { KG, G }

private val WeightKeyRowHeight = 44.dp
private val WeightKeySpacing = 6.dp
private val WeightConfirmColumnWidth = 72.dp

@Composable
fun WeightProductDialog(
    productName: String,
    pricePerKg: Double,
    currencySymbol: String,
    scaleEnabled: Boolean,
    reading: AclasScaleReading?,
    scaleConnectionMessage: String? = null,
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    var buffer by remember { mutableStateOf("") }
    var entryUnit by remember { mutableStateOf(WeightEntryUnit.KG) }
    var manualOverride by remember { mutableStateOf(false) }

    LaunchedEffect(reading, entryUnit) {
        if (manualOverride) return@LaunchedEffect
        val live = reading ?: return@LaunchedEffect
        if (live.weightKg <= 0.0) return@LaunchedEffect
        buffer = when (entryUnit) {
            WeightEntryUnit.KG -> String.format(Locale.US, "%.3f", live.weightKg)
            WeightEntryUnit.G -> (live.weightKg * 1000.0).roundToInt().toString()
        }
    }

    DisposableEffect(entryUnit) {
        ScaleWedgeHub.enabled = true
        val listener: (ScaleWedgeHub.Reading, Boolean) -> Unit = { wedge, confirmed ->
            manualOverride = false
            val unit = when (wedge.displayUnit) {
                ScaleWedgeParser.Result.DisplayUnit.KG -> WeightEntryUnit.KG
                ScaleWedgeParser.Result.DisplayUnit.G -> WeightEntryUnit.G
            }
            entryUnit = unit
            buffer = ScaleWedgeParser.formatBuffer(
                wedge.weightKg,
                wedge.displayUnit
            )
            if (confirmed && wedge.weightKg > 0.0) {
                onConfirm(wedge.weightKg)
            }
        }
        ScaleWedgeHub.addListener(listener)
        onDispose {
            ScaleWedgeHub.removeListener(listener)
            ScaleWedgeHub.enabled = false
        }
    }

    val parsedValue = buffer.replace(",", ".").toDoubleOrNull() ?: 0.0
    val weightKg = when (entryUnit) {
        WeightEntryUnit.KG -> parsedValue
        WeightEntryUnit.G -> parsedValue / 1000.0
    }.coerceAtLeast(0.0)
    val lineTotal = (weightKg * pricePerKg).coerceAtLeast(0.0)
    val stable = reading?.status == AclasScaleStatus.STABLE

    fun appendKey(key: String) {
        manualOverride = true
        buffer = when (key) {
            "." -> when {
                entryUnit == WeightEntryUnit.G -> buffer
                buffer.contains(".") -> buffer
                buffer.isEmpty() -> "0."
                else -> buffer + "."
            }
            else -> if (buffer == "0") key else buffer + key
        }.take(12)
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        val keypadBlockHeight = WeightKeyRowHeight * 4 + WeightKeySpacing * 3

        Surface(
            modifier = Modifier
                .widthIn(min = 580.dp, max = 880.dp)
                .fillMaxWidth(0.84f)
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            shadowElevation = 10.dp
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(
                            text = productName,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp,
                            lineHeight = 20.sp
                        )
                        Text(
                            text = stringResource(
                                R.string.weight_price_per_kg,
                                formatWeightMoney(pricePerKg, currencySymbol)
                            ),
                            fontSize = 12.sp,
                            color = Color(0xFF78716C),
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel))
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .height(IntrinsicSize.Min),
                    horizontalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            WeightUnitChip(
                                label = stringResource(R.string.weight_unit_kg_upper),
                                selected = entryUnit == WeightEntryUnit.KG,
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    entryUnit = WeightEntryUnit.KG
                                    manualOverride = false
                                    buffer = ""
                                }
                            )
                            WeightUnitChip(
                                label = stringResource(R.string.weight_unit_g_upper),
                                selected = entryUnit == WeightEntryUnit.G,
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    entryUnit = WeightEntryUnit.G
                                    manualOverride = false
                                    buffer = ""
                                }
                            )
                        }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                                .background(Color(0xFFFAFAF9), RoundedCornerShape(12.dp))
                                .padding(horizontal = 16.dp, vertical = 14.dp)
                        ) {
                            Text(
                                text = if (buffer.isEmpty()) {
                                    "0 ${entryUnitLabel(entryUnit)}"
                                } else {
                                    "$buffer ${entryUnitLabel(entryUnit)}"
                                },
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.End,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 28.sp
                            )
                            Text(
                                text = stringResource(
                                    R.string.weight_line_total,
                                    String.format(Locale.US, "%.3f", weightKg),
                                    formatWeightMoney(lineTotal, currencySymbol)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                                textAlign = TextAlign.End,
                                fontSize = 13.sp,
                                color = Color(0xFF78716C)
                            )
                        }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    Icons.Default.Scale,
                                    contentDescription = null,
                                    tint = Color(0xFF78716C),
                                    modifier = Modifier.height(16.dp)
                                )
                                Text(
                                    text = stringResource(R.string.scale_section_aclas),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF78716C)
                                )
                            }
                            when {
                                !scaleEnabled -> Text(
                                    text = stringResource(R.string.scale_configure_print_hint),
                                    fontSize = 11.sp,
                                    color = Color(0xFF92400E)
                                )
                                reading == null && !scaleConnectionMessage.isNullOrBlank() -> Text(
                                    text = scaleConnectionMessage,
                                    fontSize = 11.sp,
                                    color = Color(0xFF92400E)
                                )
                                reading == null -> Text(
                                    text = stringResource(R.string.scale_waiting_reading),
                                    fontSize = 11.sp,
                                    color = Color(0xFF78716C)
                                )
                                else -> Text(
                                    text = stringResource(
                                        R.string.scale_live_reading,
                                        AclasScaleProtocol.formatWeight(reading.weightKg),
                                        if (stable) {
                                            reading.status.name
                                        } else {
                                            "${reading.status.name} — ${stringResource(R.string.scale_unstable)}"
                                        }
                                    ),
                                    fontSize = 11.sp,
                                    color = if (stable) Color(0xFF16A085) else Color(0xFFE67E22)
                                )
                            }
                        }
                    }

                    VerticalDivider(
                        modifier = Modifier.fillMaxHeight(),
                        color = Color(0xFFE5E7EB)
                    )

                    Row(
                        modifier = Modifier
                            .widthIn(min = 220.dp, max = 280.dp)
                            .padding(start = 14.dp),
                        horizontalArrangement = Arrangement.spacedBy(WeightKeySpacing)
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(WeightKeySpacing)
                        ) {
                            listOf(
                                listOf("7", "8", "9"),
                                listOf("4", "5", "6"),
                                listOf("1", "2", "3"),
                                listOf("0", ".", "⌫")
                            ).forEach { row ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(WeightKeySpacing)
                                ) {
                                    row.forEach { key ->
                                        when (key) {
                                            "⌫" -> WeightKey(
                                                label = "",
                                                icon = Icons.AutoMirrored.Filled.Backspace,
                                                modifier = Modifier.weight(1f),
                                                tint = Color(0xFFB91C1C),
                                                background = Color(0xFFFEF2F2),
                                                onClick = {
                                                    manualOverride = true
                                                    buffer = buffer.dropLast(1)
                                                }
                                            )
                                            "." -> WeightKey(
                                                label = ".",
                                                modifier = Modifier.weight(1f),
                                                enabled = entryUnit == WeightEntryUnit.KG,
                                                background = Color(0xFFFFF7ED),
                                                onClick = { appendKey(".") }
                                            )
                                            else -> WeightKey(
                                                label = key,
                                                modifier = Modifier.weight(1f),
                                                onClick = { appendKey(key) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        Button(
                            onClick = { if (weightKg > 0.0) onConfirm(weightKg) },
                            enabled = weightKg > 0.0,
                            modifier = Modifier
                                .width(WeightConfirmColumnWidth)
                                .height(keypadBlockHeight),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen),
                            contentPadding = ButtonDefaults.ContentPadding
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardReturn,
                                contentDescription = stringResource(R.string.confirm),
                                tint = Color.White
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun entryUnitLabel(unit: WeightEntryUnit): String =
    when (unit) {
        WeightEntryUnit.KG -> "kg"
        WeightEntryUnit.G -> "g"
    }

@Composable
private fun WeightUnitChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val bg = if (selected) Color(0xFFD1FAE5) else Color.White
    val borderColor = if (selected) Color(0xFF6EE7B7) else Color(0xFFE5E7EB)
    val textColor = if (selected) Color(0xFF065F46) else Color(0xFF44403C)
    Box(
        modifier = modifier
            .height(40.dp)
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .background(bg, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = textColor
        )
    }
}

@Composable
private fun WeightKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    tint: Color = VectronColors.TextPrimary,
    background: Color = VectronColors.KeypadButton,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(WeightKeyRowHeight)
            .background(if (enabled) background else Color(0xFFF3F4F6), RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(8.dp))
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier),
        contentAlignment = Alignment.Center
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = tint)
        } else {
            Text(label, fontWeight = FontWeight.Bold, color = if (enabled) tint else Color.Transparent)
        }
    }
}

private fun formatWeightMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
