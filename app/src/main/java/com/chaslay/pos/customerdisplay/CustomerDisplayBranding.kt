package com.chaslay.pos.customerdisplay

data class CustomerDisplayBranding(
    val merchantName: String = "",
    val logoUrl: String? = null,
    val promoImageUrl: String? = null,
    val thankYouSubtitle: String = "Thank you for visiting",
)
