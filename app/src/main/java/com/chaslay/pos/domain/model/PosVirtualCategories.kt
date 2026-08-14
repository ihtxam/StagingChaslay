package com.chaslay.pos.domain.model

/** Virtual POS menu categories (not stored in the catalog DB). */
object PosVirtualCategories {
    /** Show all catalog products */
    const val ALL_CATEGORIES_ID: Long = -3L
    const val MOST_SOLD_ID: Long = -1L
    const val GIFT_CARDS_ID: Long = -2L

    fun isVirtual(id: Long?): Boolean = id != null && id < 0L

    fun isAllCategories(id: Long?): Boolean = id == null || id == ALL_CATEGORIES_ID

    fun isMostSold(id: Long?): Boolean = id == MOST_SOLD_ID

    fun isGiftCards(id: Long?): Boolean = id == GIFT_CARDS_ID
}
