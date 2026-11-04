package com.chaslay.pos.ui.settings
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.Alignment
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 300.dp)
                    .fillMaxWidth()
                    .border(1.dp, posUiColors().border, PosShapes.Medium)
                    .background(androidx.compose.ui.graphics.Color.White, PosShapes.Medium)
                    .padding(horizontal = 12.dp, vertical = 16.dp),
            ) {
            previewText.trimEnd().lineSequence().forEach { line ->
                val isMetaLine = line.contains(" · ") && line.count { it == '·' } >= 2
                Text(
                    text = line,
                    fontFamily = FontFamily.Monospace,
                    fontSize = if (isMetaLine) 11.sp else 10.sp,
                    lineHeight = if (isMetaLine) 14.sp else 13.sp,
                    letterSpacing = 0.2.sp,
                    fontWeight = if (isMetaLine) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isMetaLine) PosColors.Teal700 else posUiColors().textPrimary,
                    textAlign = if (isMetaLine) TextAlign.Center else TextAlign.Start,
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(
                            if (isMetaLine) {
                                Modifier.padding(vertical = 4.dp)
                            } else {
                                Modifier
                            }
                        ),
                )
            }
            }
        }
    }
}
