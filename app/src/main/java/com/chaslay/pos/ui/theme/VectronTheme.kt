package com.chaslay.pos.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class VectronPalette(
    val background: Color,
    val panelDark: Color,
    val panelLight: Color,
    val header: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val gridGap: Color,
    val keypadButton: Color,
    val keypadText: Color,
    val totalBar: Color,
    val sidebar: Color,
    val cartBackground: Color,
    val cartHeader: Color,
    val selectedCategory: Color
) {
    val cashGreen: Color get() = VectronColors.CashGreen
    val cardBlue: Color get() = VectronColors.CardBlue
    val defaultProduct: Color get() = VectronColors.DefaultProduct
}

object VectronPalettes {
    val Light = VectronPalette(
        background = PosColors.Canvas,
        panelDark = PosColors.Surface,
        panelLight = PosColors.SurfaceSubtle,
        header = PosColors.Surface,
        textPrimary = PosColors.TextPrimary,
        textSecondary = PosColors.TextSecondary,
        gridGap = PosColors.Border,
        keypadButton = PosColors.SurfaceMuted,
        keypadText = PosColors.TextPrimary,
        totalBar = PosColors.Primary,
        sidebar = PosColors.SurfaceSubtle,
        cartBackground = PosColors.Surface,
        cartHeader = PosColors.SurfaceSubtle,
        selectedCategory = PosColors.SurfaceSelected,
    )

    val Dark = VectronPalette(
        background = Color(0xFF12181A),
        panelDark = Color(0xFF1A2224),
        panelLight = Color(0xFF252E30),
        header = Color(0xFF1A2224),
        textPrimary = Color(0xFFE8EAEB),
        textSecondary = Color(0xFF9AA3A8),
        gridGap = Color(0xFF2A3436),
        keypadButton = Color(0xFF2E383B),
        keypadText = Color(0xFFE8EAEB),
        totalBar = Color(0xFF152038),
        sidebar = Color(0xFF1A2224),
        cartBackground = Color(0xFF1A2224),
        cartHeader = Color(0xFF252E30),
        selectedCategory = PosColors.Teal700,
    )
}

val LocalVectronPalette = staticCompositionLocalOf { VectronPalettes.Light }

@Composable
fun ProvideVectronTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalVectronPalette provides if (darkTheme) VectronPalettes.Dark else VectronPalettes.Light,
        content = content
    )
}

@Composable
fun vectronColors(): VectronPalette = LocalVectronPalette.current
