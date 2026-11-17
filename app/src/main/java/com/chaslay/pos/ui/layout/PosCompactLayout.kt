package com.chaslay.pos.ui.layout

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import com.chaslay.pos.domain.model.PosCompactLayoutPreference
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.vectronColors
import kotlinx.coroutines.yield

/** MetaPlexus 8″ handoff: portrait width ~400–480dp (800×1280 @ mdpi). */
private const val COMPACT_PORTRAIT_MAX_WIDTH_DP = 480

/**
 * Auto compact only for portrait 8″-class devices — not via [Configuration.smallestScreenWidthDp]
 * alone (that would pull 10.1″ landscape into compact when the shortest side is still ≤900dp).
 */
fun isAutoCompactPortraitLayout(configuration: Configuration): Boolean {
    val portrait = configuration.screenHeightDp > configuration.screenWidthDp
    if (!portrait) return false
    return configuration.screenWidthDp <= COMPACT_PORTRAIT_MAX_WIDTH_DP ||
        configuration.smallestScreenWidthDp <= COMPACT_PORTRAIT_MAX_WIDTH_DP
}

@Composable
fun rememberUsePosCompactPortraitLayout(
    preference: PosCompactLayoutPreference = PosCompactLayoutPreference.AUTO,
): Boolean {
    val configuration = LocalConfiguration.current
    return remember(configuration, preference) {
        when (preference) {
            PosCompactLayoutPreference.ON -> true
            PosCompactLayoutPreference.OFF -> false
            PosCompactLayoutPreference.AUTO -> isAutoCompactPortraitLayout(configuration)
        }
    }
}

/** Holds a brief splash until orientation and compact preference are stable (avoids wide→compact flash). */
@Composable
fun rememberPosCompactLayoutSettled(): Boolean {
    val configuration = LocalConfiguration.current
    var settled by remember { mutableStateOf(false) }
    LaunchedEffect(
        configuration.screenWidthDp,
        configuration.screenHeightDp,
        configuration.orientation,
    ) {
        settled = false
        yield()
        settled = true
    }
    return settled
}

@Composable
fun PosCompactLayoutSplash(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(vectronColors().background),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(color = PosColors.Primary)
    }
}