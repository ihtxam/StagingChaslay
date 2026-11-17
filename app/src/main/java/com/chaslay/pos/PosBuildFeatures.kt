package com.chaslay.pos

/**
 * Compile-time switches for this release.
 * On-device Sunmi customer display stays off (D3 Mini has no working CDS).
 */
object PosBuildFeatures {
    /**
     * Sunmi/D3 rear Presentation and line-LCD customer display, including branding fetch.
     * When false, the till does not start [com.chaslay.pos.customerdisplay.CustomerDisplayCoordinator].
     */
    const val SUNMI_LOCAL_CUSTOMER_DISPLAY_ENABLED = false

    /**
     * Settings → Floor & Waiters. Hidden for this release; the screen and sync stay in the app.
     */
    const val FLOOR_AND_WAITERS_NAV_VISIBLE = false
}
