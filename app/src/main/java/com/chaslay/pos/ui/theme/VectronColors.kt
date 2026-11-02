package com.chaslay.pos.ui.theme

import androidx.compose.ui.graphics.Color

object VectronColors {
    val PrimaryTeal = PosColors.Primary
    val SuccessGreen = PosColors.Success

    /** Primary actions (pay, confirm, add to order). */
    val CashGreen = PosColors.Primary

    val CardBlue = PosColors.Info

    val Background = PosColors.Canvas
    val PanelDark = PosColors.Surface
    val PanelLight = PosColors.SurfaceSubtle
    val Header = PosColors.Surface
    val TextPrimary = PosColors.TextPrimary
    val TextSecondary = PosColors.TextSecondary
    val GridGap = PosColors.Border
    val DefaultProduct = Color(0xFF4A6FA5)
    val KeypadButton = PosColors.SurfaceMuted
    val KeypadText = PosColors.TextPrimary
    val TotalBar = PosColors.Primary
    val SelectedCategory = PosColors.SurfaceSelected
}

fun categoryColor(hex: String): Color =
    runCatching { Color(android.graphics.Color.parseColor(hex)) }
        .getOrDefault(VectronColors.DefaultProduct)
