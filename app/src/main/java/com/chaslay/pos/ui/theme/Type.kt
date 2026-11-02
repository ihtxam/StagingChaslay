package com.chaslay.pos.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val PosFontFamily = FontFamily.SansSerif

/** Typography colors are unset so [androidx.compose.material3.Text] follows [MaterialTheme.colorScheme]. */
val PosTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 30.sp,
        lineHeight = 36.sp,
        color = Color.Unspecified,
    ),
    headlineMedium = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 29.sp,
        color = Color.Unspecified,
    ),
    titleLarge = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 22.sp,
        color = Color.Unspecified,
    ),
    titleMedium = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 23.sp,
        color = Color.Unspecified,
    ),
    bodyLarge = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 23.sp,
        color = Color.Unspecified,
    ),
    bodyMedium = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = Color.Unspecified,
    ),
    bodySmall = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 17.sp,
        color = Color.Unspecified,
    ),
    labelLarge = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = Color.Unspecified,
    ),
    labelMedium = TextStyle(
        fontFamily = PosFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 17.sp,
        color = Color.Unspecified,
    ),
)
