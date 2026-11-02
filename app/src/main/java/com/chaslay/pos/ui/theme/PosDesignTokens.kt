package com.chaslay.pos.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Design tokens from POS_Cursor_Design_Package (Complete Design Handoff). */
// Display/text scaling: [ProvidePosAppearanceScale] in MainActivity adjusts [LocalDensity] app-wide.
object PosColors {
    val Teal50 = Color(0xFFE8F8F6)
    val Teal100 = Color(0xFFC9EFEB)
    val Teal200 = Color(0xFF9DE0D9)
    val Teal300 = Color(0xFF66CFC6)
    val Teal400 = Color(0xFF2DB8AD)
    val Teal500 = Color(0xFF079B8F)
    val Teal600 = Color(0xFF067B73)
    val Teal700 = Color(0xFF05635D)
    val Teal900 = Color(0xFF033A37)

    val Primary = Teal500
    val PrimaryHover = Teal600
    val PrimaryActive = Teal700
    val PrimarySubtle = Teal50
    val PrimaryBorder = Teal200
    val FocusRing = Teal300

    val Canvas = Color(0xFFF5F6F7)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceSubtle = Color(0xFFF8FAFA)
    val SurfaceMuted = Color(0xFFEEF1F2)
    val SurfaceSelected = Teal50
    val Overlay = Color(0x6B0F172A)

    val Border = Color(0xFFE2E6E8)
    val BorderStrong = Color(0xFFC9D0D4)

    val TextPrimary = Color(0xFF1F2933)
    val TextSecondary = Color(0xFF66727A)
    val TextMuted = Color(0xFF8A959B)
    val TextOnPrimary = Color(0xFFFFFFFF)

    val Success = Color(0xFF18A957)
    val SuccessSubtle = Color(0xFFE8F8EF)
    val Warning = Color(0xFFD99017)
    val WarningSubtle = Color(0xFFFFF6DF)
    val Danger = Color(0xFFD92D35)
    val DangerSubtle = Color(0xFFFFF0F1)
    val Info = Color(0xFF3478C7)
    val InfoSubtle = Color(0xFFEDF5FF)
}

object PosDimens {
    val Space1 = 4.dp
    val Space2 = 8.dp
    val Space3 = 12.dp
    val Space4 = 16.dp
    val Space5 = 20.dp
    val Space6 = 24.dp
    val PagePadding = 24.dp
    val PagePaddingCompact = 16.dp
    val GridGap = 12.dp
    val ControlHeightSm = 32.dp
    val ControlHeightMd = 44.dp
    val ControlHeightLg = 52.dp
    val TouchTargetMin = 44.dp
}

object PosShapes {
    val Small = RoundedCornerShape(8.dp)
    val Medium = RoundedCornerShape(10.dp)
    val Large = RoundedCornerShape(12.dp)
    val ExtraLarge = RoundedCornerShape(16.dp)
    val Dialog = RoundedCornerShape(16.dp)
    val Card = RoundedCornerShape(12.dp)
    val Pill = RoundedCornerShape(999.dp)
}
