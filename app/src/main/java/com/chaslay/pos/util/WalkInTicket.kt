package com.chaslay.pos.util

import kotlin.random.Random

/** Guest-facing kitchen / takeaway shout (#1234) + opaque backend id (WP-…), WebPOS parity. */
object WalkInTicket {
    data class Ticket(val display: String, val backendOrderNumber: String)

    fun next(): Ticket {
        val shout = 1000 + Random.nextInt(9000)
        val display = "#$shout"
        val a = Random.nextInt(0, Int.MAX_VALUE).toString(36).uppercase().take(6)
        val b = Random.nextInt(0, Int.MAX_VALUE).toString(36).uppercase().take(4)
        val backend = "WP-$a$b".take(20)
        return Ticket(display = display, backendOrderNumber = backend)
    }
}
