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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.automirrored.filled.Backspace
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.VectronColors

private val KeyRowHeight = 28.dp
private val KeySpacing = 3.dp
private val ActionColumnWidth = 44.dp
// Enter spans the last two digit rows (44 + spacing + 44).
private val EnterKeyHeight = KeyRowHeight * 2 + KeySpacing

@Composable
fun PriceKeypadDialog(
    title: String,
    subtitle: String = stringResource(R.string.enter_price),
    currencySymbol: String,
    initialValue: String = "",
    confirmLabel: String = stringResource(R.string.add_to_cart),
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    var buffer by remember { mutableStateOf(initialValue) }

    fun appendKey(key: String) {
        buffer = when (key) {
            "00" -> if (buffer.isEmpty()) "0" else buffer + "00"
            "." -> when {
                buffer.contains(".") -> buffer
                buffer.isEmpty() -> "0."
                else -> buffer + "."
            }
            else -> if (buffer == "0") key else buffer + key
        }.take(12)
    }

    fun confirm() {
        buffer.toDoubleOrNull()?.let(onConfirm)
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .widthIn(min = 220.dp, max = 280.dp)
                .fillMaxWidth(0.46f),
            shape = RoundedCornerShape(14.dp),
            color = Color.White,
            shadowElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .padding(12.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(subtitle, fontSize = 11.sp, color = Color.Gray)
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.5.dp, Color(0xFF9CA3AF), RoundedCornerShape(10.dp))
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(KeySpacing)
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(KeySpacing)
                    ) {
                        listOf(
                            listOf("7", "8", "9"),
                            listOf("4", "5", "6"),
                            listOf("1", "2", "3"),
                            listOf("0", "00", ".")
                        ).forEach { row ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(KeySpacing)
                            ) {
                                row.forEach { key ->
                                    PriceKey(
                                        label = key,
                                        modifier = Modifier.weight(1f),
                                        onClick = { appendKey(key) }
                                    )
                                }
                            }
                        }
                    }
                    Column(
                        modifier = Modifier.width(ActionColumnWidth),
                        verticalArrangement = Arrangement.spacedBy(KeySpacing)
                    ) {
                        PriceKey(
                            label = "",
                            icon = Icons.AutoMirrored.Filled.Backspace,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { buffer = buffer.dropLast(1) }
                        )
                        PriceKey(
                            label = stringResource(R.string.keypad_clear),
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { buffer = "" }
                        )
                        PriceKey(
                            label = "",
                            icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                            modifier = Modifier.fillMaxWidth(),
                            keyHeight = EnterKeyHeight,
                            highlight = true,
                            onClick = ::confirm
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .height(40.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(stringResource(R.string.cancel), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    Button(
                        onClick = ::confirm,
                        modifier = Modifier
                            .weight(1f)
                            .height(40.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                    ) {
                        Text(confirmLabel, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun PriceKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    keyHeight: Dp = KeyRowHeight,
    highlight: Boolean = false,
    onClick: () -> Unit
) {
    val bg = when {
        highlight -> VectronColors.CashGreen
        else -> VectronColors.KeypadButton
    }
    Box(
        modifier = modifier
            .height(keyHeight)
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (highlight) Color.White else VectronColors.TextPrimary
            )
        } else {
            Text(
                label,
                fontWeight = FontWeight.Bold,
                color = if (highlight) Color.White else VectronColors.TextPrimary
            )
        }
    }
}
