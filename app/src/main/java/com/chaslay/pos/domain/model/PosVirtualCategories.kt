package com.chaslay.pos.domain.model

/** Virtual POS menu categories (not stored in the catalog DB). */
object PosVirtualCategories {
    const val MOST_SOLD_ID: Long = -1L
    const val GIFT_CARDS_ID: Long = -2L

    fun isVirtual(id: Long?): Boolean = id != null && id < 0L

    fun isMostSold(id: Long?): Boolean = id == MOST_SOLD_ID

    fun isGiftCards(id: Long?): Boolean = id == GIFT_CARDS_ID
}
