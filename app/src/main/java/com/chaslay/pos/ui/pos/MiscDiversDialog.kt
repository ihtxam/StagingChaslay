package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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

enum class MiscRateUnit { PER_KG, PER_G }

data class MiscDiversResult(
    val rate: Double,
    val rateUnit: MiscRateUnit,
    val weightKg: Double,
    /** When true, [rate] is the full line price (legacy custom amount), not a per-kg/g rate. */
    val isFlatLinePrice: Boolean = false
)

private fun AclasScaleReading?.hasValidWeighingWeight(): Boolean {
    val live = this ?: return false
    return live.weightKg > 0.0 && live.status == AclasScaleStatus.STABLE
}

private enum class MiscField { RATE, WEIGHT }

private enum class MiscWeightUnit { KG, G }

private val MiscKeyRowHeight = 44.dp
private val MiscKeySpacing = 6.dp
private val MiscConfirmWidth = 72.dp

@Composable
fun MiscDiversDialog(
    currencySymbol: String,
    scaleEnabled: Boolean,
    scaleConfigured: Boolean = false,
    reading: AclasScaleReading?,
    scaleConnectionMessage: String? = null,
    onConfirm: (MiscDiversResult) -> Unit,
    onDismiss: () -> Unit
) {
    var rateBuffer by remember { mutableStateOf("") }
    var weightBuffer by remember { mutableStateOf("") }
    var rateUnit by remember { mutableStateOf(MiscRateUnit.PER_KG) }
    var weightEntryUnit by remember { mutableStateOf(MiscWeightUnit.KG) }
    var activeField by remember { mutableStateOf(MiscField.RATE) }
    var weightManualOverride by remember { mutableStateOf(false) }
    val scaleCheckoutActive = scaleEnabled && scaleConfigured
    val scaleWeighingActive = scaleCheckoutActive && reading.hasValidWeighingWeight()
    // Match WebPOS: flat CHF until USB scale delivers weight; manual rate×weight when scale is off.
    val flatAmountMode = scaleCheckoutActive && !scaleWeighingActive
    val weightLockedFromScale = scaleWeighingActive

    LaunchedEffect(reading, weightEntryUnit, weightLockedFromScale) {
        if (!weightLockedFromScale || weightManualOverride) return@LaunchedEffect
        val live = reading ?: return@LaunchedEffect
        if (live.weightKg <= 0.0) return@LaunchedEffect
        weightBuffer = when (weightEntryUnit) {
            MiscWeightUnit.KG -> String.format(Locale.US, "%.3f", live.weightKg)
            MiscWeightUnit.G -> (live.weightKg * 1000.0).roundToInt().toString()
        }
    }

    LaunchedEffect(weightLockedFromScale) {
        if (weightLockedFromScale) activeField = MiscField.RATE
    }

    DisposableEffect(Unit) {
        ScaleWedgeHub.enabled = true
        val listener: (ScaleWedgeHub.Reading, Boolean) -> Unit = listener@{ wedge, confirmed ->
            if (!weightLockedFromScale) return@listener
            weightManualOverride = false
            val unit = when (wedge.displayUnit) {
                ScaleWedgeParser.Result.DisplayUnit.KG -> MiscWeightUnit.KG
                ScaleWedgeParser.Result.DisplayUnit.G -> MiscWeightUnit.G
            }
            weightEntryUnit = unit
            weightBuffer = ScaleWedgeParser.formatBuffer(wedge.weightKg, wedge.displayUnit)
            if (confirmed && wedge.weightKg > 0.0 && rateBuffer.isNotBlank()) {
                val rate = rateBuffer.replace(",", ".").toDoubleOrNull() ?: return@listener
                if (rate > 0.0) {
                    onConfirm(
                        MiscDiversResult(
                            rate = rate,
                            rateUnit = rateUnit,
                            weightKg = wedge.weightKg
                        )
                    )
                }
            }
        }
        ScaleWedgeHub.addListener(listener)
        onDispose {
            ScaleWedgeHub.removeListener(listener)
            ScaleWedgeHub.enabled = false
        }
    }

    val rateValue = rateBuffer.replace(",", ".").toDoubleOrNull() ?: 0.0
    val weightParsed = weightBuffer.replace(",", ".").toDoubleOrNull() ?: 0.0
    val weightKg = when (weightEntryUnit) {
        MiscWeightUnit.KG -> weightParsed
        MiscWeightUnit.G -> weightParsed / 1000.0
    }.coerceAtLeast(0.0)
    val pricePerKg = when (rateUnit) {
        MiscRateUnit.PER_KG -> rateValue
        MiscRateUnit.PER_G -> rateValue * 1000.0
    }
    val lineTotal = if (flatAmountMode) {
        rateValue.coerceAtLeast(0.0)
    } else {
        (pricePerKg * weightKg).coerceAtLeast(0.0)
    }
    val stable = reading?.status == AclasScaleStatus.STABLE
    val keypadBlockHeight = MiscKeyRowHeight * 4 + MiscKeySpacing * 3

    fun appendKey(key: String) {
        if (activeField != MiscField.RATE && weightLockedFromScale) return
        when (activeField) {
            MiscField.RATE -> {
                rateBuffer = miscAppendDigit(rateBuffer, key, allowDecimal = true).take(12)
            }
            MiscField.WEIGHT -> {
                weightManualOverride = true
                val allowDecimal = weightEntryUnit == MiscWeightUnit.KG
                weightBuffer = miscAppendDigit(weightBuffer, key, allowDecimal = allowDecimal).take(12)
            }
        }
    }

    fun tryConfirm() {
        if (flatAmountMode) {
            if (rateValue <= 0.0) return
            onConfirm(
                MiscDiversResult(
                    rate = rateValue,
                    rateUnit = rateUnit,
                    weightKg = 0.0,
                    isFlatLinePrice = true
                )
            )
            return
        }
        if (rateValue <= 0.0 || weightKg <= 0.0) return
        onConfirm(MiscDiversResult(rate = rateValue, rateUnit = rateUnit, weightKg = weightKg))
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
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
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(
                            text = stringResource(R.string.misc_item),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = stringResource(
                                when {
                                    flatAmountMode -> R.string.misc_divers_subtitle_flat
                                    scaleWeighingActive -> R.string.misc_divers_subtitle_scale
                                    else -> R.string.misc_divers_subtitle
                                }
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
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MiscFieldSelector(
                            label = stringResource(
                                if (flatAmountMode) R.string.misc_amount_label else R.string.misc_rate_label
                            ),
                            selected = activeField == MiscField.RATE,
                            onClick = { activeField = MiscField.RATE }
                        )
                        if (!flatAmountMode) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                MiscUnitChip(
                                    label = stringResource(R.string.misc_rate_per_kg),
                                    selected = rateUnit == MiscRateUnit.PER_KG,
                                    modifier = Modifier.weight(1f),
                                    onClick = { rateUnit = MiscRateUnit.PER_KG }
                                )
                                MiscUnitChip(
                                    label = stringResource(R.string.misc_rate_per_g),
                                    selected = rateUnit == MiscRateUnit.PER_G,
                                    modifier = Modifier.weight(1f),
                                    onClick = { rateUnit = MiscRateUnit.PER_G }
                                )
                            }
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    if (activeField == MiscField.RATE) 2.dp else 1.dp,
                                    if (activeField == MiscField.RATE) Color(0xFF14B8A6) else Color(0xFFE5E7EB),
                                    RoundedCornerShape(12.dp)
                                )
                                .background(Color(0xFFFAFAF9), RoundedCornerShape(12.dp))
                                .clickable { activeField = MiscField.RATE }
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = if (rateBuffer.isEmpty()) {
                                    "$currencySymbol 0"
                                } else {
                                    "$currencySymbol $rateBuffer"
                                },
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.End,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 24.sp
                            )
                        }

                        if (!flatAmountMode) {
                            MiscFieldSelector(
                                label = stringResource(R.string.misc_weight_label),
                                selected = !weightLockedFromScale && activeField == MiscField.WEIGHT,
                                onClick = {
                                    if (!weightLockedFromScale) activeField = MiscField.WEIGHT
                                }
                            )
                        }
                        if (!scaleEnabled) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                MiscUnitChip(
                                    label = stringResource(R.string.weight_unit_kg_upper),
                                    selected = weightEntryUnit == MiscWeightUnit.KG,
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        weightEntryUnit = MiscWeightUnit.KG
                                        weightManualOverride = false
                                    }
                                )
                                MiscUnitChip(
                                    label = stringResource(R.string.weight_unit_g_upper),
                                    selected = weightEntryUnit == MiscWeightUnit.G,
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        weightEntryUnit = MiscWeightUnit.G
                                        weightManualOverride = false
                                    }
                                )
                            }
                        }
                        if (!flatAmountMode) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    width = if (!weightLockedFromScale && activeField == MiscField.WEIGHT) 2.dp else 1.dp,
                                    color = if (!weightLockedFromScale && activeField == MiscField.WEIGHT) {
                                        Color(0xFF14B8A6)
                                    } else {
                                        Color(0xFFE5E7EB)
                                    },
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .background(
                                    if (weightLockedFromScale) Color(0xFFF5F5F4) else Color(0xFFFAFAF9),
                                    RoundedCornerShape(12.dp)
                                )
                                .then(
                                    if (weightLockedFromScale) {
                                        Modifier
                                    } else {
                                        Modifier.clickable { activeField = MiscField.WEIGHT }
                                    }
                                )
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = if (weightBuffer.isEmpty()) {
                                    "0 ${weightUnitLabel(weightEntryUnit)}"
                                } else {
                                    "$weightBuffer ${weightUnitLabel(weightEntryUnit)}"
                                },
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.End,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 24.sp
                            )
                        }
                        } else {
                            Text(
                                text = stringResource(R.string.misc_no_scale_weight),
                                fontSize = 12.sp,
                                color = Color(0xFF78716C),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        Text(
                            text = stringResource(
                                R.string.misc_line_total,
                                formatMiscMoney(lineTotal, currencySymbol)
                            ),
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.End,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF44403C)
                        )

                        if (!scaleEnabled) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    Icons.Default.Scale,
                                    contentDescription = null,
                                    tint = Color(0xFF92400E),
                                    modifier = Modifier.height(16.dp)
                                )
                                Text(
                                    text = stringResource(R.string.scale_configure_print_hint),
                                    fontSize = 11.sp,
                                    color = Color(0xFF92400E)
                                )
                            }
                        } else if (reading != null) {
                            Text(
                                text = stringResource(
                                    R.string.scale_live_reading,
                                    AclasScaleProtocol.formatWeight(reading.weightKg),
                                    if (stable) reading.status.name else "${reading.status.name} — ${stringResource(R.string.scale_unstable)}"
                                ),
                                fontSize = 11.sp,
                                color = if (stable) Color(0xFF16A085) else Color(0xFFE67E22)
                            )
                        } else if (!scaleConnectionMessage.isNullOrBlank()) {
                            Text(
                                text = scaleConnectionMessage,
                                fontSize = 11.sp,
                                color = Color(0xFF92400E)
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.scale_waiting_reading),
                                fontSize = 11.sp,
                                color = Color(0xFF78716C)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.widthIn(min = 240.dp, max = 300.dp),
                        horizontalArrangement = Arrangement.spacedBy(MiscKeySpacing)
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(MiscKeySpacing)
                        ) {
                            listOf(
                                listOf("7", "8", "9"),
                                listOf("4", "5", "6"),
                                listOf("1", "2", "3"),
                                listOf("0", ".", "⌫")
                            ).forEach { row ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(MiscKeySpacing)
                                ) {
                                    row.forEach { key ->
                                        when (key) {
                                            "⌫" -> MiscKey(
                                                label = "",
                                                icon = Icons.AutoMirrored.Filled.Backspace,
                                                modifier = Modifier.weight(1f),
                                                tint = Color(0xFFB91C1C),
                                                background = Color(0xFFFEF2F2),
                                                onClick = {
                                                    when (activeField) {
                                                        MiscField.RATE -> rateBuffer = rateBuffer.dropLast(1)
                                                        MiscField.WEIGHT -> {
                                                            if (weightLockedFromScale) return@MiscKey
                                                            weightManualOverride = true
                                                            weightBuffer = weightBuffer.dropLast(1)
                                                        }
                                                    }
                                                }
                                            )
                                            "." -> MiscKey(
                                                label = ".",
                                                modifier = Modifier.weight(1f),
                                                enabled = when (activeField) {
                                                    MiscField.RATE -> true
                                                    MiscField.WEIGHT -> !weightLockedFromScale && weightEntryUnit == MiscWeightUnit.KG
                                                },
                                                background = Color(0xFFFFF7ED),
                                                onClick = { appendKey(".") }
                                            )
                                            else -> MiscKey(
                                                label = key,
                                                modifier = Modifier.weight(1f),
                                                enabled = activeField == MiscField.RATE || !weightLockedFromScale,
                                                onClick = { appendKey(key) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        Button(
                            onClick = ::tryConfirm,
                            enabled = if (flatAmountMode) rateValue > 0.0 else rateValue > 0.0 && weightKg > 0.0,
                            modifier = Modifier
                                .width(MiscConfirmWidth)
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

private fun miscAppendDigit(buffer: String, key: String, allowDecimal: Boolean): String =
    when (key) {
        "." -> when {
            !allowDecimal -> buffer
            buffer.contains(".") -> buffer
            buffer.isEmpty() -> "0."
            else -> buffer + "."
        }
        else -> if (buffer == "0") key else buffer + key
    }

private fun weightUnitLabel(unit: MiscWeightUnit): String =
    when (unit) {
        MiscWeightUnit.KG -> "kg"
        MiscWeightUnit.G -> "g"
    }

private fun formatMiscMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

@Composable
private fun MiscFieldSelector(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text = label,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = if (selected) Color(0xFF0F766E) else Color(0xFF78716C),
        modifier = Modifier.clickable(onClick = onClick)
    )
}

@Composable
private fun MiscUnitChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val bg = if (selected) Color(0xFFD1FAE5) else Color.White
    val borderColor = if (selected) Color(0xFF6EE7B7) else Color(0xFFE5E7EB)
    Box(
        modifier = modifier
            .height(36.dp)
            .border(1.dp, borderColor, RoundedCornerShape(10.dp))
            .background(bg, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            color = if (selected) Color(0xFF065F46) else Color(0xFF44403C)
        )
    }
}

@Composable
private fun MiscKey(
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
            .height(MiscKeyRowHeight)
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
