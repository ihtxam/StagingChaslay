package com.chaslay.pos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R

@Composable
fun posSwitchColors() = SwitchDefaults.colors(
    checkedThumbColor = PosColors.TextOnPrimary,
    checkedTrackColor = PosColors.Primary,
    checkedBorderColor = PosColors.Primary,
    uncheckedThumbColor = MaterialTheme.colorScheme.surface,
    uncheckedTrackColor = posUiColors().borderStrong,
    uncheckedBorderColor = posUiColors().borderStrong,
    disabledCheckedThumbColor = PosColors.TextOnPrimary.copy(alpha = 0.75f),
    disabledCheckedTrackColor = PosColors.Primary.copy(alpha = 0.38f),
    disabledCheckedBorderColor = PosColors.Primary.copy(alpha = 0.38f),
    disabledUncheckedThumbColor = posUiColors().surfaceMuted,
    disabledUncheckedTrackColor = posUiColors().border.copy(alpha = 0.6f),
    disabledUncheckedBorderColor = posUiColors().border.copy(alpha = 0.6f),
)

@Composable
fun PosSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    showStateLabel: Boolean = false,
) {
    if (!showStateLabel) {
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier = modifier,
            enabled = enabled,
            colors = posSwitchColors(),
        )
        return
    }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.End,
    ) {
        Text(
            text = stringResource(
                if (checked) R.string.switch_state_enabled else R.string.switch_state_disabled
            ),
            color = if (enabled) {
                if (checked) PosColors.Primary else MaterialTheme.colorScheme.onSurfaceVariant
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
            },
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.width(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = posSwitchColors(),
        )
    }
}
