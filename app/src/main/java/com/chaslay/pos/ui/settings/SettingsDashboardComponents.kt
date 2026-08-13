package com.chaslay.pos.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon

internal object SettingsDashColors {
    val Surface = Color(0xFFFFFFFF)
    val Hairline = Color(0x1A000000)
    val Accent = Color(0xFF13A99A)
    val TextPrimary = Color(0xFF121826)
    val TextSecondary = Color(0xFF556377)
}

@Composable
internal fun SettingsPageHeader(title: String, subtitle: String? = null) {
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
        Text(
            title,
            color = SettingsDashColors.TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        subtitle?.let {
            Text(
                it,
                color = SettingsDashColors.TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
internal fun SettingsSectionCard(
    title: String,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SettingsDashColors.Surface)
            .border(1.dp, SettingsDashColors.Hairline, RoundedCornerShape(14.dp))
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = SettingsDashColors.Accent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
            }
            Text(
                title,
                color = SettingsDashColors.TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
        Spacer(Modifier.size(12.dp))
        content()
    }
}
