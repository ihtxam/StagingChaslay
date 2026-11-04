package com.chaslay.pos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

/**
 * Semantic POS colors that follow [MaterialTheme.colorScheme] (light/dark from [ChaslayPosTheme]).
 * Brand accents (Primary, Success, …) stay on [PosColors].
 */
@Immutable
data class PosUiColors(
    val canvas: Color,
    val surface: Color,
    val surfaceSubtle: Color,
    val surfaceMuted: Color,
    val surfaceSelected: Color,
    val border: Color,
    val borderStrong: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val primarySubtle: Color,
    val primaryBorder: Color,
    val successSubtle: Color,
    val warningSubtle: Color,
    val dangerSubtle: Color,
    val infoSubtle: Color,
)

@Composable
@ReadOnlyComposable
fun posUiColors(): PosUiColors {
    val scheme = MaterialTheme.colorScheme
    val isLight = scheme.background.luminance() > 0.5f
    return if (isLight) {
        PosUiColors(
            canvas = PosColors.Canvas,
            surface = PosColors.Surface,
            surfaceSubtle = PosColors.SurfaceSubtle,
            surfaceMuted = PosColors.SurfaceMuted,
            surfaceSelected = PosColors.SurfaceSelected,
            border = PosColors.Border,
            borderStrong = PosColors.BorderStrong,
            textPrimary = PosColors.TextPrimary,
            textSecondary = PosColors.TextSecondary,
            textMuted = PosColors.TextMuted,
            primarySubtle = PosColors.PrimarySubtle,
            primaryBorder = PosColors.PrimaryBorder,
            successSubtle = PosColors.SuccessSubtle,
            warningSubtle = PosColors.WarningSubtle,
            dangerSubtle = PosColors.DangerSubtle,
            infoSubtle = PosColors.InfoSubtle,
        )
    } else {
        PosUiColors(
            canvas = scheme.background,
            surface = scheme.surface,
            surfaceSubtle = scheme.surfaceVariant.copy(alpha = 1f),
            surfaceMuted = scheme.surfaceVariant,
            surfaceSelected = scheme.primaryContainer,
            border = scheme.outline,
            borderStrong = scheme.outlineVariant,
            textPrimary = scheme.onSurface,
            textSecondary = scheme.onSurfaceVariant,
            textMuted = scheme.onSurfaceVariant.copy(alpha = 0.72f),
            primarySubtle = scheme.primaryContainer,
            primaryBorder = scheme.outline,
            successSubtle = Color(0xFF1A3324),
            warningSubtle = Color(0xFF3D3010),
            dangerSubtle = scheme.errorContainer,
            infoSubtle = Color(0xFF1A2838),
        )
    }
}

private fun Color.luminance(): Float {
    val r = red
    val g = green
    val b = blue
    return 0.2126f * r + 0.7152f * g + 0.0722f * b
}
