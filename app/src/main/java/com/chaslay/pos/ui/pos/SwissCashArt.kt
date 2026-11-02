package com.chaslay.pos.ui.pos

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.chaslay.pos.R

/**
 * CHF cash tile art bundled under res/drawable-nodpi/.
 *
 * Banknotes: Swiss National Bank 9th series obverse images (public domain, Art. 5 Swiss Copyright Act)
 * via Wikimedia Commons category "Official images of banknotes of Switzerland, 9th series".
 *
 * Coins: circulation coin photos from Wikimedia Commons (public domain as Swiss means of payment);
 * see File:CHF_coins.jpg for source montage credits.
 */
internal data class SwissDenomTile(
    val value: Double,
    @DrawableRes val imageRes: Int?,
)

internal fun swissDenomTiles(currencyCode: String): List<SwissDenomTile>? {
    if (currencyCode.uppercase() != "CHF") return null
    return listOf(
        SwissDenomTile(200.0, R.drawable.chf_note_200),
        SwissDenomTile(100.0, R.drawable.chf_note_100),
        SwissDenomTile(50.0, R.drawable.chf_note_50),
        SwissDenomTile(20.0, R.drawable.chf_note_20),
        SwissDenomTile(10.0, R.drawable.chf_note_10),
        SwissDenomTile(5.0, R.drawable.chf_coin_5),
        SwissDenomTile(2.0, R.drawable.chf_coin_2),
        SwissDenomTile(1.0, R.drawable.chf_coin_1),
        SwissDenomTile(0.50, R.drawable.chf_coin_50r),
        SwissDenomTile(0.20, R.drawable.chf_coin_20r),
        SwissDenomTile(0.10, R.drawable.chf_coin_10r),
        SwissDenomTile(0.05, R.drawable.chf_coin_5r),
    )
}

@Composable
internal fun SwissDenominationArt(
    tile: SwissDenomTile,
    modifier: Modifier = Modifier,
) {
    val res = tile.imageRes ?: return
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Image(
            painter = painterResource(res),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

internal fun chfDenomTileFor(value: Double, currencyCode: String): SwissDenomTile? {
    val tiles = swissDenomTiles(currencyCode) ?: return null
    return tiles.firstOrNull { kotlin.math.abs(it.value - value) < 0.001 }
}
