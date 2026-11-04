package com.chaslay.pos.ui.pos
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.ui.components.PosVectorIcon
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import java.util.Locale

fun defaultCashDenominations(currencyCode: String): List<Double> {
    return when (currencyCode.uppercase(Locale.US)) {
        "CHF" -> listOf(200.0, 100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.20, 0.10, 0.05)
        "EUR" -> listOf(200.0, 100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.20, 0.10, 0.05)
        else -> listOf(100.0, 50.0, 20.0, 10.0, 5.0, 2.0, 1.0, 0.50, 0.25, 0.10, 0.05)
    }
}

@Composable
fun CashPaymentDialog(
    totalDue: Double,
    currencySymbol: String,
    currencyCode: String,
    denominations: List<Double> = defaultCashDenominations(currencyCode),
    isProcessing: Boolean,
    useModernVisuals: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (enteredAmount: Double) -> Unit
) {
    var enteredAmount by remember { mutableDoubleStateOf(0.0) }
    var keypadBuffer by remember { mutableStateOf("") }

    val pendingKeypadAmount = keypadPendingAmount(keypadBuffer)
    val previewReceivedAmount = enteredAmount + pendingKeypadAmount
    val remaining = (totalDue - previewReceivedAmount).coerceAtLeast(0.0)
    val change = (previewReceivedAmount - totalDue).coerceAtLeast(0.0)
    val canConfirm = !isProcessing && enteredAmount + 0.001 >= totalDue
    val swissTiles = remember(currencyCode) { swissDenomTiles(currencyCode) }
    val moneyLocale = remember {
        when (currencyCode.uppercase(Locale.US)) {
            "CHF", "EUR" -> Locale.FRENCH
            else -> Locale.getDefault()
        }
    }

    fun addEnteredAmount(delta: Double) {
        if (isProcessing || delta <= 0.001) return
        enteredAmount += delta
        if (enteredAmount + 0.001 >= totalDue) {
            onConfirm(enteredAmount)
        }
    }

    fun onDenominationTap(value: Double) {
        addEnteredAmount(value)
    }

    fun onKeypadAddAmount() {
        val add = keypadBuffer.toDoubleOrNull() ?: 0.0
        if (add <= 0.001) return
        keypadBuffer = ""
        addEnteredAmount(add)
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
                .widthIn(max = 1120.dp)
                .padding(vertical = 12.dp),
            shape = PosShapes.Dialog,
            tonalElevation = 6.dp,
            color = posUiColors().surface,
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (useModernVisuals) {
                        PosVectorIcon(
                            resId = R.drawable.ic_pos_payment_cash,
                            contentDescription = null,
                            tint = PosColors.Primary,
                            modifier = Modifier.size(28.dp),
                        )
                    } else {
                        Icon(
                            Icons.Outlined.AccountBalanceWallet,
                            contentDescription = null,
                            tint = PosColors.Primary,
                            modifier = Modifier.size(28.dp),
                        )
                    }
                    Text(
                        stringResource(R.string.cash_payment_title),
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    IconButton(onClick = onDismiss, enabled = !isProcessing) {
                        Icon(Icons.Outlined.Close, contentDescription = stringResource(R.string.cancel))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val stacked = maxWidth < 820.dp
                    if (stacked) {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            CashPaymentSummaryColumn(
                                totalDue = totalDue,
                                enteredAmount = previewReceivedAmount,
                                remaining = remaining,
                                change = change,
                                currencySymbol = currencySymbol,
                                moneyLocale = moneyLocale,
                            )
                            CashPaymentDenominationsColumn(
                                currencyCode = currencyCode,
                                currencySymbol = currencySymbol,
                                denominations = denominations,
                                swissTiles = swissTiles,
                                onTap = ::onDenominationTap,
                            )
                            CashPaymentKeypadColumn(
                                keypadBuffer = keypadBuffer,
                                onKey = { key -> keypadBuffer = appendCashKeypad(keypadBuffer, key) },
                                onClear = { keypadBuffer = "" },
                                onAddAmount = ::onKeypadAddAmount,
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            CashPaymentSummaryColumn(
                                modifier = Modifier.weight(0.95f),
                                totalDue = totalDue,
                                enteredAmount = previewReceivedAmount,
                                remaining = remaining,
                                change = change,
                                currencySymbol = currencySymbol,
                                moneyLocale = moneyLocale,
                            )
                            CashPaymentDenominationsColumn(
                                modifier = Modifier.weight(1.35f),
                                currencyCode = currencyCode,
                                currencySymbol = currencySymbol,
                                denominations = denominations,
                                swissTiles = swissTiles,
                                onTap = ::onDenominationTap,
                            )
                            CashPaymentKeypadColumn(
                                modifier = Modifier.weight(0.95f),
                                keypadBuffer = keypadBuffer,
                                onKey = { key -> keypadBuffer = appendCashKeypad(keypadBuffer, key) },
                                onClear = { keypadBuffer = "" },
                                onAddAmount = ::onKeypadAddAmount,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End),
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !isProcessing,
                        modifier = Modifier.heightIn(min = 48.dp),
                        shape = PosShapes.Medium,
                    ) {
                        Text(stringResource(R.string.cancel), fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = { onConfirm(enteredAmount) },
                        enabled = canConfirm,
                        modifier = Modifier
                            .heightIn(min = 48.dp)
                            .widthIn(min = 140.dp),
                        shape = PosShapes.Medium,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PosColors.Primary,
                            disabledContainerColor = Color(0xFFD1D5DB),
                        ),
                    ) {
                        Text(
                            stringResource(R.string.confirm),
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
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
    moneyLocale: Locale,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(PosShapes.Large)
            .background(posUiColors().surface)
            .border(1.dp, posUiColors().border, PosShapes.Large)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        CashSummaryBlock(
            label = stringResource(R.string.cash_payment_total),
            amount = formatCashMoney(totalDue, currencySymbol, moneyLocale),
            amountColor = posUiColors().textPrimary,
            labelColor = posUiColors().textSecondary,
        )
        CashSummaryBlock(
            label = stringResource(R.string.cash_payment_entered),
            amount = formatCashMoney(enteredAmount, currencySymbol, moneyLocale),
            amountColor = PosColors.Primary,
            labelColor = PosColors.Primary,
            borderColor = posUiColors().primaryBorder,
            backgroundColor = posUiColors().primarySubtle,
            emphasizeAmount = true,
        )
        CashSummaryBlock(
            label = stringResource(R.string.cash_payment_still_to_pay),
            amount = formatCashMoney(remaining, currencySymbol, moneyLocale),
            amountColor = PosColors.Danger,
            labelColor = PosColors.Danger,
        )
        CashSummaryBlock(
            label = stringResource(R.string.cash_payment_change),
            amount = formatCashMoney(change, currencySymbol, moneyLocale),
            amountColor = Color(0xFF92400E),
            labelColor = Color(0xFF92400E),
            backgroundColor = posUiColors().warningSubtle,
            borderColor = Color(0xFFFCD34D),
            emphasizeAmount = true,
        )
    }
}

@Composable
private fun CashSummaryBlock(
    label: String,
    amount: String,
    amountColor: Color,
    labelColor: Color,
    borderColor: Color = Color.Unspecified,
    backgroundColor: Color = Color.Unspecified,
    emphasizeAmount: Boolean = false,
) {
    val ui = posUiColors()
    val resolvedBorder = if (borderColor == Color.Unspecified) ui.border else borderColor
    val resolvedBackground = if (backgroundColor == Color.Unspecified) ui.surfaceSubtle else backgroundColor
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(PosShapes.Large)
            .background(resolvedBackground)
            .border(if (emphasizeAmount) 2.dp else 1.dp, resolvedBorder, PosShapes.Large)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = labelColor,
        )
        Text(
            amount,
            fontSize = if (emphasizeAmount) 32.sp else 28.sp,
            fontWeight = FontWeight.Bold,
            color = amountColor,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
        )
    }
}

@Composable
private fun CashPaymentDenominationsColumn(
    currencyCode: String,
    currencySymbol: String,
    denominations: List<Double>,
    swissTiles: List<SwissDenomTile>?,
    onTap: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(PosShapes.Large)
            .background(posUiColors().surface)
            .border(1.dp, posUiColors().border, PosShapes.Large)
            .padding(14.dp),
    ) {
        Text(
            stringResource(R.string.cash_payment_bills_coins),
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            color = posUiColors().textPrimary,
        )
        Text(
            stringResource(R.string.cash_payment_tap_denominations),
            fontSize = 12.sp,
            color = posUiColors().textSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        val rows = denominations.chunked(4)
        rows.forEach { rowValues ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                rowValues.forEach { value ->
                    val tile = chfDenomTileFor(value, currencyCode)
                    CashDenomButton(
                        value = value,
                        currencySymbol = currencySymbol,
                        swissTile = tile,
                        modifier = Modifier.weight(1f),
                        onClick = { onTap(value) },
                    )
                }
                repeat((4 - rowValues.size).coerceAtLeast(0)) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun CashDenomButton(
    value: Double,
    currencySymbol: String,
    swissTile: SwissDenomTile?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(PosShapes.Medium)
            .background(Color.White)
            .border(1.dp, posUiColors().border, PosShapes.Medium)
            .clickable(onClick = onClick)
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.35f)
                .clip(PosShapes.Small),
            contentAlignment = Alignment.Center,
        ) {
            when {
                swissTile?.imageRes != null -> {
                    SwissDenominationArt(tile = swissTile, modifier = Modifier.fillMaxSize())
                }
                swissTile != null -> {
                    Text(
                        formatDenominationLabel(value, currencySymbol),
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = posUiColors().textSecondary,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            formatDenominationLabel(value, currencySymbol),
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            color = posUiColors().textPrimary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CashPaymentKeypadColumn(
    keypadBuffer: String,
    onKey: (String) -> Unit,
    onClear: () -> Unit,
    onAddAmount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(PosShapes.Large)
            .background(posUiColors().surface)
            .border(1.dp, posUiColors().border, PosShapes.Large)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            stringResource(R.string.cash_payment_keypad_title),
            fontWeight = FontWeight.Bold,
            fontSize = 15.sp,
            color = posUiColors().textPrimary,
        )
        Spacer(modifier = Modifier.height(4.dp))
        listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
        ).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                row.forEach { key ->
                    CashKey(
                        label = key,
                        modifier = Modifier.weight(1f),
                        onClick = { onKey(key) },
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CashKey(
                label = stringResource(R.string.cash_payment_ce),
                modifier = Modifier.weight(1f),
                tone = CashKeyTone.Clear,
                onClick = onClear,
            )
            CashKey(label = "0", modifier = Modifier.weight(1f), onClick = { onKey("0") })
            CashKey(label = ".", modifier = Modifier.weight(1f), onClick = { onKey(".") })
        }
        CashKey(
            label = "+  ${stringResource(R.string.cash_payment_add_amount)}",
            modifier = Modifier.fillMaxWidth(),
            tone = CashKeyTone.Accent,
            onClick = onAddAmount,
        )
    }
}

private enum class CashKeyTone { Normal, Clear, Accent }

@Composable
private fun CashKey(
    label: String,
    modifier: Modifier = Modifier,
    tone: CashKeyTone = CashKeyTone.Normal,
    onClick: () -> Unit,
) {
    val bg = when (tone) {
        CashKeyTone.Accent -> PosColors.Primary
        CashKeyTone.Clear -> Color(0xFFFEE2E2)
        CashKeyTone.Normal -> Color.White
    }
    val fg = when (tone) {
        CashKeyTone.Accent -> Color.White
        CashKeyTone.Clear -> Color(0xFFB91C1C)
        CashKeyTone.Normal -> posUiColors().textPrimary
    }
    val border = when (tone) {
        CashKeyTone.Accent -> PosColors.Primary
        CashKeyTone.Clear -> Color(0xFFFECACA)
        CashKeyTone.Normal -> posUiColors().border
    }
    Box(
        modifier = modifier
            .heightIn(min = 48.dp)
            .clip(PosShapes.Medium)
            .background(bg)
            .border(1.dp, border, PosShapes.Medium)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontWeight = FontWeight.Bold,
            fontSize = if (tone == CashKeyTone.Accent) 13.sp else 18.sp,
            color = fg,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

private fun keypadPendingAmount(buffer: String): Double {
    if (buffer.isBlank()) return 0.0
    return buffer.toDoubleOrNull() ?: 0.0
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

private fun formatCashMoney(amount: Double, symbol: String, locale: Locale): String {
    val numeric = String.format(locale, "%,.2f", amount.coerceAtLeast(0.0))
    return "$symbol $numeric"
}

private fun formatDenominationLabel(value: Double, symbol: String): String {
    val numeric = if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        String.format(Locale.US, "%.2f", value)
    }
    return if (value >= 1.0) numeric else "$symbol $numeric"
}
