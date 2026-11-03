package com.chaslay.pos.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

/** User-controlled POS display zoom and text size (Settings → Appearance). */
data class PosAppearanceScale(
    val displayScale: Float = 1f,
    val textScale: Float = 1f,
)

val LocalPosAppearanceScale = staticCompositionLocalOf { PosAppearanceScale() }

object PosAppearanceLimits {
    const val DISPLAY_MIN = 0.75f
    const val DISPLAY_MAX = 1f
    const val DISPLAY_STEP = 0.05f
    const val TEXT_MIN = 0.85f
    const val TEXT_MAX = 1.3f
    const val TEXT_STEP = 0.05f

    fun clampDisplay(raw: Float): Float =
        raw.coerceIn(DISPLAY_MIN, DISPLAY_MAX).let { v ->
            (kotlin.math.round(v / DISPLAY_STEP) * DISPLAY_STEP).coerceIn(DISPLAY_MIN, DISPLAY_MAX)
        }

    fun clampText(raw: Float): Float =
        raw.coerceIn(TEXT_MIN, TEXT_MAX).let { v ->
            (kotlin.math.round(v / TEXT_STEP) * TEXT_STEP).coerceIn(TEXT_MIN, TEXT_MAX)
        }
}

@Composable
fun ProvidePosAppearanceScale(
    displayScale: Float,
    textScale: Float,
    content: @Composable () -> Unit
) {
    val base = LocalDensity.current
    val appearance = PosAppearanceScale(
        displayScale = PosAppearanceLimits.clampDisplay(displayScale),
        textScale = PosAppearanceLimits.clampText(textScale),
    )
    val scaledDensity = Density(
        density = base.density * appearance.displayScale,
        fontScale = base.fontScale * appearance.textScale,
    )
    CompositionLocalProvider(
        LocalDensity provides scaledDensity,
        LocalPosAppearanceScale provides appearance,
        content = content,
    )
}
