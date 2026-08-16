package com.chaslay.pos.util

import android.content.Context

/** Sequential counter-style dine-in ticket (e.g. D-001) per device session. */
object DineInCounterTicket {
    private const val PREFS = "dine_in_counter_v1"
    private const val KEY_SEQ = "seq"

    data class Ticket(val display: String, val orderNumber: String)

    fun next(context: Context): Ticket {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val next = prefs.getInt(KEY_SEQ, 0) + 1
        prefs.edit().putInt(KEY_SEQ, next).apply()
        val display = "D-${next.toString().padStart(3, '0')}"
        val stamp = System.currentTimeMillis().toString(36).uppercase()
        val orderNumber = "DI-$stamp-${next.toString().padStart(4, '0')}".take(20)
        return Ticket(display = display, orderNumber = orderNumber)
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_SEQ)
            .apply()
    }
}
