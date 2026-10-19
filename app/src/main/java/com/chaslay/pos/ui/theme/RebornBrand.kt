package com.chaslay.pos.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import kotlin.math.hypot

/** Official Reborn palette — aligned with dashboard brand-colors.ts and LoginPage. */
object RebornBrand {
    val Burgundy = Color(0xFF800020)
    val BurgundyLight = Color(0xFFB8324A)
    val BlueCharcoal = Color(0xFF17252B)
    val WarmWhite = Color(0xFFFAF8F3)

    val Black = Color(0xFF000000)
    val White = Color(0xFFFFFFFF)
    val Gray50 = Color(0xFFFAFAFA)
    val Gray100 = Color(0xFFF5F5F5)
    val Gray200 = Color(0xFFE5E5E5)
    val Gray400 = Color(0xFF9CA3AF)
    val Gray600 = Color(0xFF525252)
    val Gray800 = Color(0xFF262626)
    val Gray900 = Color(0xFF171717)

    /** Sidebar / activation full-screen gradient (145deg). */
    val SidebarGradient: Brush
        @Composable get() = Brush.linearGradient(
            colors = listOf(Burgundy, BurgundyLight),
            start = Offset.Zero,
            end = Offset(400f, 600f)
        )

}

/** Charcoal + top burgundy glow matching app.rebornsense.com/login. */
fun Modifier.rebornLoginBackground(): Modifier = this.drawBehind {
    drawRect(RebornBrand.BlueCharcoal)
    drawRect(
        brush = Brush.radialGradient(
            colorStops = arrayOf(
                0f to Color(0x59800020),
                0.55f to Color.Transparent,
                1f to Color.Transparent
            ),
            center = Offset(size.width * 0.5f, 0f),
            radius = hypot(size.width * 0.5f, size.height * 0.55f)
        )
    )
}
