// Applied: POS_Cursor_Design_Package — Complete Design Handoff (teal primary, light canvas #F5F6F7).
package com.chaslay.pos.ui.theme

import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset

private val LightColors = lightColorScheme(
    primary = PosColors.Primary,
    onPrimary = PosColors.TextOnPrimary,
    primaryContainer = PosColors.PrimarySubtle,
    onPrimaryContainer = PosColors.Teal700,
    secondary = PosColors.TextSecondary,
    onSecondary = PosColors.TextOnPrimary,
    tertiary = PosColors.Info,
    onTertiary = PosColors.TextOnPrimary,
    background = PosColors.Canvas,
    onBackground = PosColors.TextPrimary,
    surface = PosColors.Surface,
    onSurface = PosColors.TextPrimary,
    surfaceVariant = PosColors.SurfaceMuted,
    onSurfaceVariant = PosColors.TextSecondary,
    outline = PosColors.Border,
    outlineVariant = PosColors.BorderStrong,
    error = PosColors.Danger,
    onError = PosColors.TextOnPrimary,
    errorContainer = PosColors.DangerSubtle,
    onErrorContainer = PosColors.Danger,
)

// Handoff targets light theme; dark scheme uses teal accents on neutral surfaces for readable contrast.
private val DarkColors = darkColorScheme(
    primary = PosColors.Teal300,
    onPrimary = PosColors.Teal900,
    primaryContainer = PosColors.Teal700,
    onPrimaryContainer = PosColors.Teal100,
    secondary = PosColors.TextMuted,
    onSecondary = Color(0xFFE8EAEB),
    tertiary = PosColors.Info,
    onTertiary = PosColors.TextOnPrimary,
    background = Color(0xFF12181A),
    onBackground = Color(0xFFE8EAEB),
    surface = Color(0xFF1A2224),
    onSurface = Color(0xFFE8EAEB),
    surfaceVariant = Color(0xFF252E30),
    onSurfaceVariant = PosColors.TextMuted,
    outline = Color(0xFF3D484B),
    outlineVariant = Color(0xFF2A3436),
    error = PosColors.Danger,
    onError = PosColors.TextOnPrimary,
    errorContainer = Color(0xFF4A1518),
    onErrorContainer = PosColors.DangerSubtle,
)

private val PosMaterialShapes = Shapes(
    extraSmall = PosShapes.Small,
    small = PosShapes.Medium,
    medium = PosShapes.Large,
    large = PosShapes.ExtraLarge,
    extraLarge = PosShapes.Dialog,
)

@Composable
fun ChaslayPosTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = PosTypography,
        shapes = PosMaterialShapes,
        content = content
    )
}

object PosPaymentColors {
    val Cash = PosColors.Primary
    val Card = PosColors.Info
}

/** POS canvas used on login, loading, and shell backgrounds (follows active theme). */
@Composable
fun Modifier.posCanvasBackground(): Modifier = background(MaterialTheme.colorScheme.background)

/** Subtle brand panel for wide login hero. */
fun Modifier.posBrandHeroBackground(): Modifier = this.background(
    brush = Brush.linearGradient(
        colors = listOf(PosColors.Teal600, PosColors.Primary, PosColors.Teal400),
        start = Offset.Zero,
        end = Offset(800f, 1200f),
    )
)
