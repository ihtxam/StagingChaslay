package com.chaslay.pos.ui.auth
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.STAFF_PIN_QUICK_LOGIN_LENGTH
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes

@Composable
fun PinDotsDisplay(
    pinLength: Int,
    maxLength: Int = STAFF_PIN_QUICK_LOGIN_LENGTH,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(maxLength) { index ->
            val filled = index < pinLength
            Box(
                modifier = Modifier
                    .padding(horizontal = 6.dp)
                    .size(if (filled) 16.dp else 13.dp)
                    .clip(CircleShape)
                    .background(if (filled) PosColors.Primary else posUiColors().surfaceMuted)
                    .border(
                        width = 1.dp,
                        color = if (filled) PosColors.Primary else posUiColors().borderStrong,
                        shape = CircleShape
                    )
            )
        }
    }
}

private enum class KeyVariant { Digit, Muted, Primary }

private val KeypadRowSpacing = 10.dp
private val KeypadKeySpacing = 10.dp
private val KeyMinHeight = PosDimens.ControlHeightMd
private val EnterKeyHeight = PosDimens.ControlHeightMd

@Composable
fun PinLoginKeypad(
    onDigit: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit,
    onEnter: () -> Unit,
    modifier: Modifier = Modifier,
    enterEnabled: Boolean = true
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(KeypadRowSpacing)
    ) {
        listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9")
        ).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(KeypadKeySpacing)
            ) {
                row.forEach { key ->
                    PinKey(
                        label = key,
                        modifier = Modifier.weight(1f),
                        onClick = { onDigit(key) }
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(KeypadKeySpacing)
        ) {
            PinKey(
                label = stringResource(R.string.keypad_clear),
                modifier = Modifier.weight(1f),
                variant = KeyVariant.Muted,
                onClick = onClear
            )
            PinKey(
                label = "0",
                modifier = Modifier.weight(1f),
                onClick = { onDigit("0") }
            )
            PinKey(
                label = "",
                icon = Icons.AutoMirrored.Filled.Backspace,
                modifier = Modifier.weight(1f),
                variant = KeyVariant.Muted,
                onClick = onBackspace
            )
        }
        PinKey(
            label = stringResource(R.string.login),
            modifier = Modifier
                .fillMaxWidth()
                .height(EnterKeyHeight),
            variant = KeyVariant.Primary,
            enabled = enterEnabled,
            fillHeight = true,
            onClick = onEnter
        )
    }
}

@Composable
private fun PinKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    variant: KeyVariant = KeyVariant.Digit,
    enabled: Boolean = true,
    fillHeight: Boolean = false,
    onClick: () -> Unit
) {
    val bg = when {
        !enabled -> posUiColors().surfaceMuted
        variant == KeyVariant.Primary -> PosColors.Primary
        variant == KeyVariant.Muted -> posUiColors().surfaceSubtle
        else -> posUiColors().surfaceSubtle
    }
    val contentColor = when {
        !enabled -> posUiColors().textMuted
        variant == KeyVariant.Primary -> PosColors.TextOnPrimary
        variant == KeyVariant.Muted -> posUiColors().textSecondary
        else -> posUiColors().textPrimary
    }
    val borderColor = when {
        !enabled -> posUiColors().border
        variant == KeyVariant.Primary -> PosColors.Primary
        else -> posUiColors().border
    }
    val shape = PosShapes.Large
    val heightMod = if (fillHeight) {
        modifier
    } else {
        modifier.heightIn(min = KeyMinHeight, max = KeyMinHeight)
    }
    Column(
        modifier = heightMod
            .clip(shape)
            .background(bg)
            .border(1.dp, borderColor, shape)
            .clickable(enabled = enabled, onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(22.dp)
            )
        } else {
            Text(
                text = label,
                fontWeight = if (variant == KeyVariant.Primary) FontWeight.Bold else FontWeight.SemiBold,
                color = contentColor,
                fontSize = when (variant) {
                    KeyVariant.Primary -> 16.sp
                    KeyVariant.Muted -> 13.sp
                    else -> 20.sp
                },
                textAlign = TextAlign.Center
            )
        }
    }
}
