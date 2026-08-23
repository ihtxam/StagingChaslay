package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Scale
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import com.chaslay.pos.ui.theme.VectronColors
import java.util.Locale
import kotlin.math.roundToInt

private enum class WeightEntryUnit { KG, G }

@Composable
fun WeightProductDialog(
    productName: String,
    pricePerKg: Double,
    currencySymbol: String,
    scaleEnabled: Boolean,
    reading: AclasScaleReading?,
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
            "00" -> if (buffer.isEmpty()) "0" else buffer + "00"
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
        Surface(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .fillMaxWidth(0.46f)
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp)),
            shape = RoundedCornerShape(12.dp),
            color = Color.White
        ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.weighed_product_title),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = productName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF374151)
                        )
                        Text(
                            text = stringResource(
                                R.string.weight_price_per_kg,
                                formatWeightMoney(pricePerKg, currencySymbol)
                            ),
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel))
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    WeightUnitChip(
                        label = stringResource(R.string.weight_unit_kg),
                        selected = entryUnit == WeightEntryUnit.KG,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            entryUnit = WeightEntryUnit.KG
                            manualOverride = false
                            buffer = ""
                        }
                    )
                    WeightUnitChip(
                        label = stringResource(R.string.weight_unit_g),
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
                        .background(Color(0xFFF9FAFB), RoundedCornerShape(12.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = if (buffer.isEmpty()) {
                            "0 ${if (entryUnit == WeightEntryUnit.KG) "kg" else "g"}"
                        } else {
                            "$buffer ${if (entryUnit == WeightEntryUnit.KG) "kg" else "g"}"
                        },
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                    Text(
                        text = stringResource(
                            R.string.weight_line_total,
                            String.format(Locale.US, "%.3f", weightKg),
                            formatWeightMoney(lineTotal, currencySymbol)
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                        fontSize = 13.sp,
                        color = Color(0xFF6B7280)
                    )
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(
                            Icons.Default.Scale,
                            contentDescription = null,
                            tint = Color(0xFF6B7280),
                            modifier = Modifier.height(16.dp)
                        )
                        Text(
                            text = stringResource(R.string.scale_section),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6B7280)
                        )
                    }
                    when {
                        !scaleEnabled -> Text(
                            text = stringResource(R.string.scale_not_connected),
                            fontSize = 12.sp,
                            color = Color(0xFFB91C1C)
                        )
                        reading == null -> Text(
                            text = stringResource(R.string.scale_waiting_reading),
                            fontSize = 12.sp,
                            color = Color(0xFF6B7280)
                        )
                        else -> {
                            Text(
                                text = stringResource(
                                    R.string.scale_live_reading,
                                    AclasScaleProtocol.formatWeight(reading.weightKg),
                                    reading.status.name
                                ),
                                fontSize = 12.sp,
                                color = Color(0xFF374151)
                            )
                            Text(
                                text = if (stable) {
                                    stringResource(R.string.scale_stable)
                                } else {
                                    stringResource(R.string.scale_unstable)
                                },
                                fontSize = 12.sp,
                                color = if (stable) Color(0xFF16A085) else Color(0xFFE67E22)
                            )
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(
                            listOf("7", "8", "9"),
                            listOf("4", "5", "6"),
                            listOf("1", "2", "3"),
                            listOf("0", "00", if (entryUnit == WeightEntryUnit.KG) "." else "")
                        ).forEach { row ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                row.forEach { key ->
                                    if (key.isEmpty()) {
                                        WeightKey(label = "", modifier = Modifier.weight(1f), enabled = false, onClick = {})
                                    } else {
                                        WeightKey(
                                            label = key,
                                            modifier = Modifier.weight(1f),
                                            onClick = { appendKey(key) }
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Column(modifier = Modifier.weight(0.35f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        WeightKey(
                            label = "⌫",
                            onClick = {
                                manualOverride = true
                                buffer = buffer.dropLast(1)
                            }
                        )
                        WeightKey(
                            label = stringResource(R.string.keypad_clear),
                            onClick = {
                                manualOverride = true
                                buffer = ""
                            }
                        )
                        WeightKey(
                            label = "OK",
                            highlight = true,
                            onClick = {
                                if (weightKg > 0.0) onConfirm(weightKg)
                            }
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = { if (weightKg > 0.0) onConfirm(weightKg) },
                        enabled = weightKg > 0.0,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                    ) {
                        Text(stringResource(R.string.confirm))
                    }
                }
            }
        }
    }
}

@Composable
private fun WeightUnitChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val bg = if (selected) Color(0xFFD1FAE5) else VectronColors.KeypadButton
    val textColor = if (selected) Color(0xFF065F46) else VectronColors.TextPrimary
    Text(
        text = label,
        modifier = modifier
            .height(28.dp)
            .background(bg, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        textAlign = TextAlign.Center,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        color = textColor
    )
}

@Composable
private fun WeightKey(
    label: String,
    modifier: Modifier = Modifier,
    highlight: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val bg = when {
        !enabled -> Color(0xFFF3F4F6)
        highlight -> VectronColors.CashGreen
        else -> VectronColors.KeypadButton
    }
    Column(
        modifier = modifier
            .height(28.dp)
            .background(bg, RoundedCornerShape(4.dp))
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = label,
            fontWeight = FontWeight.Bold,
            color = when {
                !enabled -> Color.Transparent
                highlight -> Color.White
                else -> VectronColors.TextPrimary
            },
            fontSize = if (label.length > 2) 10.sp else 12.sp
        )
    }
}

private fun formatWeightMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
