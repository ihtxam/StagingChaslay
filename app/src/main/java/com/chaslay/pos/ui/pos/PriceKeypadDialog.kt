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
import androidx.compose.material.icons.filled.Scale
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
    /** ~2× layout for tablet readability (e.g. retail misc). */
    layoutExpanded: Boolean = false,
    /** Match [MiscDiversDialog] width, keypad, and type scale (e.g. open-price items). */
    layoutDiversWide: Boolean = false,
    showScaleHint: Boolean = false,
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    var buffer by remember { mutableStateOf(initialValue) }

    val keyRowHeight = when {
        layoutDiversWide -> 44.dp
        layoutExpanded -> 56.dp
        else -> KeyRowHeight
    }
    val keySpacing = when {
        layoutDiversWide || layoutExpanded -> 6.dp
        else -> KeySpacing
    }
    val actionColumnWidth = when {
        layoutDiversWide -> 72.dp
        layoutExpanded -> 88.dp
        else -> ActionColumnWidth
    }
    val enterKeyHeight = keyRowHeight * 2 + keySpacing
    val dialogMinWidth = when {
        layoutDiversWide -> 580.dp
        layoutExpanded -> 440.dp
        else -> 220.dp
    }
    val dialogMaxWidth = when {
        layoutDiversWide -> 880.dp
        layoutExpanded -> 560.dp
        else -> 280.dp
    }
    val dialogWidthFraction = when {
        layoutDiversWide -> 0.84f
        layoutExpanded -> 0.62f
        else -> 0.46f
    }
    val dialogCorner = if (layoutDiversWide) 16.dp else 14.dp
    val dialogElevation = if (layoutDiversWide) 10.dp else 8.dp
    val titleSize = when {
        layoutDiversWide -> 16.sp
        layoutExpanded -> 20.sp
        else -> 15.sp
    }
    val subtitleSize = when {
        layoutDiversWide -> 12.sp
        layoutExpanded -> 13.sp
        else -> 11.sp
    }
    val displaySize = when {
        layoutDiversWide -> 24.sp
        layoutExpanded -> 26.sp
        else -> 18.sp
    }
    val buttonHeight = when {
        layoutDiversWide -> 48.dp
        layoutExpanded -> 52.dp
        else -> 40.dp
    }
    val contentPadding = when {
        layoutDiversWide -> 16.dp
        layoutExpanded -> 20.dp
        else -> 12.dp
    }
    val sectionSpacing = when {
        layoutDiversWide -> 12.dp
        layoutExpanded -> 12.dp
        else -> 8.dp
    }

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
                .widthIn(min = dialogMinWidth, max = dialogMaxWidth)
                .fillMaxWidth(dialogWidthFraction)
                .then(
                    if (layoutDiversWide) {
                        Modifier.border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(dialogCorner))
                    } else {
                        Modifier
                    }
                ),
            shape = RoundedCornerShape(dialogCorner),
            color = Color.White,
            shadowElevation = dialogElevation
        ) {
            Column(
                modifier = Modifier
                    .padding(contentPadding)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(sectionSpacing)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        title,
                        fontWeight = if (layoutDiversWide) FontWeight.SemiBold else FontWeight.Bold,
                        fontSize = titleSize
                    )
                    Text(
                        subtitle,
                        fontSize = subtitleSize,
                        color = if (layoutDiversWide) Color(0xFF78716C) else Color.Gray
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(
                            if (layoutDiversWide) 1.dp else 1.5.dp,
                            if (layoutDiversWide) Color(0xFFE5E7EB) else Color(0xFF9CA3AF),
                            RoundedCornerShape(if (layoutDiversWide) 12.dp else 10.dp)
                        )
                        .background(
                            Color(if (layoutDiversWide) 0xFFFAFAF9 else 0xFFF8FAFC),
                            RoundedCornerShape(if (layoutDiversWide) 12.dp else 10.dp)
                        )
                        .padding(
                            horizontal = if (layoutDiversWide) 14.dp else 10.dp,
                            vertical = if (layoutDiversWide) 10.dp else 8.dp
                        )
                ) {
                    Text(
                        text = if (buffer.isEmpty()) {
                            if (layoutDiversWide) "$currencySymbol 0" else "$currencySymbol 0.00"
                        } else {
                            "$currencySymbol $buffer"
                        },
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.End,
                        fontWeight = if (layoutDiversWide) FontWeight.SemiBold else FontWeight.Bold,
                        fontSize = displaySize
                    )
                }

                if (showScaleHint) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                Icons.Default.Scale,
                                contentDescription = null,
                                tint = Color(0xFF78716C)
                            )
                            Text(
                                stringResource(R.string.scale_section_aclas),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF78716C)
                            )
                        }
                        Text(
                            text = stringResource(R.string.scale_hid_wedge_hint),
                            fontSize = 11.sp,
                            color = Color(0xFF78716C)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(keySpacing)
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(keySpacing)
                    ) {
                        listOf(
                            listOf("7", "8", "9"),
                            listOf("4", "5", "6"),
                            listOf("1", "2", "3"),
                            listOf("0", "00", ".")
                        ).forEach { row ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(keySpacing)
                            ) {
                                row.forEach { key ->
                                    PriceKey(
                                        label = key,
                                        modifier = Modifier.weight(1f),
                                        keyHeight = keyRowHeight,
                                        onClick = { appendKey(key) }
                                    )
                                }
                            }
                        }
                    }
                    Column(
                        modifier = Modifier.width(actionColumnWidth),
                        verticalArrangement = Arrangement.spacedBy(keySpacing)
                    ) {
                        PriceKey(
                            label = "",
                            icon = Icons.AutoMirrored.Filled.Backspace,
                            modifier = Modifier.fillMaxWidth(),
                            keyHeight = keyRowHeight,
                            onClick = { buffer = buffer.dropLast(1) }
                        )
                        PriceKey(
                            label = stringResource(R.string.keypad_clear),
                            modifier = Modifier.fillMaxWidth(),
                            keyHeight = keyRowHeight,
                            onClick = { buffer = "" }
                        )
                        PriceKey(
                            label = "",
                            icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                            modifier = Modifier.fillMaxWidth(),
                            keyHeight = enterKeyHeight,
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
                            .height(buttonHeight),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            stringResource(R.string.cancel),
                            fontWeight = FontWeight.Bold,
                            fontSize = if (layoutDiversWide || layoutExpanded) 14.sp else 12.sp
                        )
                    }
                    Button(
                        onClick = ::confirm,
                        modifier = Modifier
                            .weight(1f)
                            .height(buttonHeight),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                    ) {
                        Text(
                            confirmLabel,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = if (layoutDiversWide || layoutExpanded) 14.sp else 12.sp
                        )
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
    val corner = if (keyHeight >= 44.dp) 8.dp else 4.dp
    Box(
        modifier = modifier
            .height(keyHeight)
            .clip(RoundedCornerShape(corner))
            .background(bg)
            .then(
                if (keyHeight >= 44.dp) {
                    Modifier.border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(corner))
                } else {
                    Modifier
                }
            )
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
