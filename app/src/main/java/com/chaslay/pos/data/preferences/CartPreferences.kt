package com.chaslay.pos.data.preferences

import android.content.Context
import com.chaslay.pos.domain.model.CartSummary
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CartPreferences @Inject constructor(
    @ApplicationContext context: Context
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    fun load(): CartSummary? {
        val raw = prefs.getString(KEY_CART, null) ?: return null
        return runCatching { gson.fromJson(raw, CartSummary::class.java) }.getOrNull()
    }

    fun save(cart: CartSummary) {
        if (!shouldPersist(cart)) {
            prefs.edit().remove(KEY_CART).apply()
            return
        }
        prefs.edit().putString(KEY_CART, gson.toJson(cart)).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_CART).apply()
    }

    private fun shouldPersist(cart: CartSummary): Boolean =
        cart.items.isNotEmpty() ||
            cart.tableOrderId != null ||
            !cart.orderNumber.isNullOrBlank()

    companion object {
        private const val PREFS_NAME = "pos_cart"
        private const val KEY_CART = "cart_v1"
    }
}
