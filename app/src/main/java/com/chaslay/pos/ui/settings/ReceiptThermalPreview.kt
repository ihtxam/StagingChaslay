package com.chaslay.pos.ui.settings
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes

@Composable
fun ReceiptThermalPreview(
    previewText: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.receipt_preview_title),
            style = MaterialTheme.typography.titleSmall,
            color = posUiColors().textPrimary,
        )
        Text(
            text = stringResource(R.string.receipt_preview_hint),
            style = MaterialTheme.typography.bodySmall,
            color = posUiColors().textSecondary,
            modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, posUiColors().border, PosShapes.Medium)
                .background(posUiColors().surfaceSubtle, PosShapes.Medium)
                .padding(horizontal = 12.dp, vertical = 16.dp),
        ) {
            Text(
                text = previewText.trimEnd(),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                lineHeight = 13.sp,
                letterSpacing = 0.2.sp,
                color = posUiColors().textPrimary,
            )
        }
    }
}
