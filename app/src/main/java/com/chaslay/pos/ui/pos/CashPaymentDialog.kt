package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
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
import com.chaslay.pos.ui.theme.VectronColors
import java.util.Locale

private val TotalBlue = Color(0xFF2563EB)
private val EnteredGreen = Color(0xFF15803D)
private val OwedRed = Color(0xFFDC2626)

fun defaultCashDenominations(currencyCode: String): List<Double> {
    return when (currencyCode.uppercase(Locale.US)) {
        "CHF" -> listOf(200.0, 100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.20, 0.10, 0.05)
        "EUR" -> listOf(200.0, 100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.20, 0.10, 0.05)
        else -> listOf(100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.25, 0.10, 0.05)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CashPaymentDialog(
    totalDue: Double,
    currencySymbol: String,
    currencyCode: String,
    denominations: List<Double> = defaultCashDenominations(currencyCode),
    isProcessing: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (enteredAmount: Double) -> Unit
) {
    var enteredAmount by remember(totalDue) { mutableDoubleStateOf(0.0) }
    var keypadBuffer by remember { mutableStateOf("") }

    val remaining = (totalDue - enteredAmount).coerceAtLeast(0.0)
    val change = (enteredAmount - totalDue).coerceAtLeast(0.0)
    val canConfirm = !isProcessing && enteredAmount + 0.001 >= totalDue

    fun onDenominationTap(value: Double) {
        if (isProcessing) return
        val newEntered = enteredAmount + value
        enteredAmount = newEntered
        if (newEntered + 0.001 >= totalDue) {
            onConfirm(newEntered)
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.96f)
                .widthIn(max = 1100.dp)
                .padding(vertical = 16.dp),
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 8.dp,
            color = Color(0xFFF8FAFC)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    stringResource(R.string.cash_payment_title),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(16.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val stacked = maxWidth < 760.dp
                    if (stacked) {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            CashPaymentSummaryColumn(
                                totalDue = totalDue,
                                enteredAmount = enteredAmount,
                                remaining = remaining,
                                change = change,
                                currencySymbol = currencySymbol,
                                keypadBuffer = keypadBuffer
                            )
                            CashPaymentDenominationsColumn(
                                currencySymbol = currencySymbol,
                                denominations = denominations,
                                onTap = ::onDenominationTap
                            )
                            CashPaymentKeypadColumn(
                                keypadBuffer = keypadBuffer,
                                onKey = { key -> keypadBuffer = appendCashKeypad(keypadBuffer, key) },
                                onClear = { keypadBuffer = "" },
                                onAddAmount = {
                                    val add = keypadBuffer.toDoubleOrNull() ?: 0.0
                                    if (add > 0.001) {
                                        enteredAmount += add
                                        keypadBuffer = ""
                                    }
                                }
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            CashPaymentSummaryColumn(
                                modifier = Modifier.weight(1f),
                                totalDue = totalDue,
                                enteredAmount = enteredAmount,
                                remaining = remaining,
                                change = change,
                                currencySymbol = currencySymbol,
                                keypadBuffer = keypadBuffer
                            )
                            CashPaymentDenominationsColumn(
                                modifier = Modifier.weight(1.15f),
                                currencySymbol = currencySymbol,
                                denominations = denominations,
                                onTap = ::onDenominationTap
                            )
                            CashPaymentKeypadColumn(
                                modifier = Modifier.weight(1f),
                                keypadBuffer = keypadBuffer,
                                onKey = { key -> keypadBuffer = appendCashKeypad(keypadBuffer, key) },
                                onClear = { keypadBuffer = "" },
                                onAddAmount = {
                                    val add = keypadBuffer.toDoubleOrNull() ?: 0.0
                                    if (add > 0.001) {
                                        enteredAmount += add
                                        keypadBuffer = ""
                                    }
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !isProcessing,
                        modifier = Modifier.heightIn(min = 52.dp)
                    ) {
                        Text(stringResource(R.string.cancel), fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = { onConfirm(enteredAmount) },
                        enabled = canConfirm,
                        modifier = Modifier
                            .heightIn(min = 52.dp)
                            .widthIn(min = 160.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                    ) {
                        Text(
                            stringResource(R.string.confirm),
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CashPaymentSummaryColumn(
    totalDue: Double,
    enteredAmount: Double,
    remaining: Double,
    change: Double,
    currencySymbol: String,
    keypadBuffer: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE4E4E7), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CashAmountLine(
            label = stringResource(R.string.cash_payment_total),
            amount = formatCashMoney(totalDue, currencySymbol),
            color = TotalBlue
        )
        CashAmountLine(
            label = stringResource(R.string.cash_payment_entered),
            amount = formatCashMoney(enteredAmount, currencySymbol),
            color = EnteredGreen
        )
        if (change > 0.001) {
            CashAmountLine(
                label = stringResource(R.string.cash_payment_change),
                amount = formatCashMoney(change, currencySymbol),
                color = OwedRed
            )
        } else if (remaining > 0.001) {
            CashAmountLine(
                label = stringResource(R.string.cash_payment_still_to_pay),
                amount = formatCashMoney(remaining, currencySymbol),
                color = OwedRed
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.5.dp, Color(0xFF9CA3AF), RoundedCornerShape(12.dp))
                .background(Color(0xFFF9FAFB), RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 12.dp)
        ) {
            Text(
                text = if (keypadBuffer.isEmpty()) {
                    formatCashMoney(0.0, currencySymbol)
                } else {
                    "$currencySymbol $keypadBuffer"
                },
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp
            )
        }
    }
}

@Composable
private fun CashAmountLine(label: String, amount: String, color: Color) {
    Column {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            letterSpacing = 0.5.sp
        )
        Text(
            amount,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CashPaymentDenominationsColumn(
    currencySymbol: String,
    denominations: List<Double>,
    onTap: (Double) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE4E4E7), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Text(
            stringResource(R.string.cash_payment_tap_denominations),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF52525B),
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            denominations.forEach { value ->
                Box(
                    modifier = Modifier
                        .widthIn(min = 72.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFF4F4F5))
                        .border(1.dp, Color(0xFFD4D4D8), RoundedCornerShape(10.dp))
                        .clickable { onTap(value) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        formatDenominationLabel(value),
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = Color(0xFF18181B)
                    )
                }
            }
        }
    }
}

@Composable
private fun CashPaymentKeypadColumn(
    keypadBuffer: String,
    onKey: (String) -> Unit,
    onClear: () -> Unit,
    onAddAmount: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        listOf(
            listOf("7", "8", "9"),
            listOf("4", "5", "6"),
            listOf("1", "2", "3")
        ).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                row.forEach { key ->
                    CashKey(
                        label = key,
                        modifier = Modifier.weight(1f),
                        onClick = { onKey(key) }
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CashKey(
                label = stringResource(R.string.cash_payment_ce),
                modifier = Modifier.weight(1f),
                tone = CashKeyTone.Clear,
                onClick = onClear
            )
            CashKey(label = "0", modifier = Modifier.weight(1f), onClick = { onKey("0") })
            CashKey(label = ".", modifier = Modifier.weight(1f), onClick = { onKey(".") })
        }
        CashKey(
            label = stringResource(R.string.cash_payment_add_amount),
            modifier = Modifier.fillMaxWidth(),
            tone = CashKeyTone.Accent,
            onClick = onAddAmount
        )
    }
}

private enum class CashKeyTone { Normal, Clear, Accent }

@Composable
private fun CashKey(
    label: String,
    modifier: Modifier = Modifier,
    tone: CashKeyTone = CashKeyTone.Normal,
    onClick: () -> Unit
) {
    val bg = when (tone) {
        CashKeyTone.Accent -> VectronColors.CashGreen
        CashKeyTone.Clear -> Color(0xFFFEE2E2)
        CashKeyTone.Normal -> Color(0xFFF4F4F5)
    }
    val fg = when (tone) {
        CashKeyTone.Accent -> Color.White
        CashKeyTone.Clear -> Color(0xFFB91C1C)
        CashKeyTone.Normal -> Color(0xFF18181B)
    }
    Box(
        modifier = modifier
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(
                1.dp,
                if (tone == CashKeyTone.Normal) Color(0xFFD4D4D8) else bg,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            fontWeight = FontWeight.Bold,
            fontSize = if (tone == CashKeyTone.Accent) 14.sp else 18.sp,
            color = fg,
            textAlign = TextAlign.Center
        )
    }
}

private fun appendCashKeypad(buffer: String, key: String): String {
    return when (key) {
        "." -> when {
            buffer.contains(".") -> buffer
            buffer.isEmpty() -> "0."
            else -> buffer + "."
        }
        else -> if (buffer == "0" && key != ".") key else buffer + key
    }.take(12)
}

private fun formatCashMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatDenominationLabel(value: Double): String {
    val numeric = if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        String.format(Locale.US, "%.2f", value)
    }
    return if (value >= 1.0) numeric else "$numeric"
}
