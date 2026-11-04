package com.chaslay.pos.ui.settings

import android.text.method.LinkMovementMethod
import android.widget.TextView
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.text.HtmlCompat
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.posUiColors

@Composable
fun SettingsRichHtmlBlock(
    html: String,
    modifier: Modifier = Modifier,
    emptyFallback: String? = null,
) {
    val trimmed = html.trim()
    if (trimmed.isEmpty()) {
        Text(
            text = emptyFallback ?: stringResource(R.string.settings_about_empty),
            style = MaterialTheme.typography.bodySmall,
            color = posUiColors().textSecondary,
            modifier = modifier,
        )
        return
    }
    val textColor = posUiColors().textSecondary
    val linkColor = PosColors.Primary
    AndroidView(
        modifier = modifier,
        factory = { context ->
            TextView(context).apply {
                movementMethod = LinkMovementMethod.getInstance()
                textSize = 14f
            }
        },
        update = { textView ->
            textView.setTextColor(textColor.toArgb())
            textView.setLinkTextColor(linkColor.toArgb())
            textView.text = HtmlCompat.fromHtml(trimmed, HtmlCompat.FROM_HTML_MODE_COMPACT)
        },
    )
}
