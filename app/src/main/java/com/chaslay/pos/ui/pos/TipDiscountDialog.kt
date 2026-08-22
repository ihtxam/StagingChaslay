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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import java.util.Locale

private val Teal = Color(0xFF0D9488)
private val KeyBg = Color(0xFFF4F4F5)
private val KeyBorder = Color(0xFFD4D4D8)
private val CardBorder = Color(0xFF9CA3AF)

enum class AmountPercentMode { AMOUNT, PERCENT }

@Composable
fun TipDiscountDialog(
    title: String,
    currencySymbol: String,
    baseAmount: Double,
    presetsPercent: List<Double>,
    allowPercent: Boolean = true,
    allowAmount: Boolean = true,
    initialMode: AmountPercentMode = AmountPercentMode.AMOUNT,
    initialValue: Double = 0.0,
    onConfirm: (amount: Double, percent: Double, mode: AmountPercentMode) -> Unit,
    onDismiss: () -> Unit
) {
    var mode by remember { mutableStateOf(initialMode) }
    var buffer by remember {
        mutableStateOf(
            if (initialValue > 0) formatBuffer(initialValue) else ""
        )
    }

    fun append(key: String) {
        buffer = when (key) {
            "." -> when {
                buffer.contains(".") -> buffer
                buffer.isEmpty() -> "0."
                else -> buffer + "."
            }
            else -> if (buffer == "0") key else buffer + key
        }.take(10)
    }

    val raw = buffer.toDoubleOrNull() ?: 0.0
    val resolvedAmount = if (mode == AmountPercentMode.PERCENT) {
        (baseAmount.coerceAtLeast(0.0) * raw.coerceAtLeast(0.0) / 100.0)
    } else {
        raw.coerceAtLeast(0.0)
    }
    val display = if (mode == AmountPercentMode.PERCENT) {
        "${buffer.ifBlank { "0" }}%  →  $currencySymbol ${"%.2f".format(Locale.getDefault(), resolvedAmount)}"
    } else {
        "$currencySymbol ${buffer.ifBlank { "0" }}"
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .widthIn(min = 360.dp, max = 460.dp)
                .fillMaxWidth(0.55f),
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            shadowElevation = 10.dp
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color(0xFF1A1A1A))

                if (allowPercent && allowAmount) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ModeChip(
                            label = stringResource(R.string.tip_discount_fixed),
                            selected = mode == AmountPercentMode.AMOUNT,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                mode = AmountPercentMode.AMOUNT
                                buffer = ""
                            }
                        )
                        ModeChip(
                            label = stringResource(R.string.tip_discount_percent),
                            selected = mode == AmountPercentMode.PERCENT,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                mode = AmountPercentMode.PERCENT
                                buffer = ""
                            }
                        )
                    }
                }

                if (mode == AmountPercentMode.PERCENT && presetsPercent.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        presetsPercent.filter { it > 0 }.forEach { pct ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .border(1.dp, KeyBorder, RoundedCornerShape(10.dp))
                                    .background(if (buffer == formatBuffer(pct)) Teal.copy(alpha = 0.12f) else Color.White)
                                    .clickable { buffer = formatBuffer(pct) }
                                    .padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text("${pct.toInt()}%", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.5.dp, CardBorder, RoundedCornerShape(12.dp))
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                ) {
                    Text(
                        display,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = Color(0xFF111827)
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        listOf("1", "2", "3"),
                        listOf("4", "5", "6"),
                        listOf("7", "8", "9"),
                        listOf(".", "0", "⌫")
                    ).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            row.forEach { key ->
                                DialogKey(
                                    label = key,
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        if (key == "⌫") buffer = buffer.dropLast(1) else append(key)
                                    }
                                )
                            }
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            buffer = ""
                            onConfirm(0.0, 0.0, mode)
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(stringResource(R.string.clear), fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            val percent = if (mode == AmountPercentMode.PERCENT) raw.coerceIn(0.0, 100.0) else 0.0
                            val amount = if (mode == AmountPercentMode.AMOUNT) {
                                resolvedAmount.coerceAtMost(baseAmount.coerceAtLeast(0.0))
                            } else {
                                resolvedAmount
                            }
                            onConfirm(amount, percent, mode)
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Teal)
                    ) {
                        Text(stringResource(R.string.confirm), fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun ModeChip(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) Teal.copy(alpha = 0.14f) else Color(0xFFF4F4F5))
            .border(1.dp, if (selected) Teal else KeyBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label.uppercase(),
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = if (selected) Teal else Color(0xFF52525B)
        )
    }
}

@Composable
private fun DialogKey(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(56.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(KeyBg)
            .border(1.dp, KeyBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (label == "⌫") {
            Icon(Icons.Default.Backspace, contentDescription = null, tint = Color(0xFFB91C1C))
        } else {
            Text(label, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color(0xFF18181B))
        }
    }
}

private fun formatBuffer(value: Double): String =
    if (value == kotlin.math.floor(value)) value.toInt().toString()
    else String.format(Locale.US, "%.2f", value)
