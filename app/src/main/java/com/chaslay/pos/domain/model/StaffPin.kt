package com.chaslay.pos.domain.model

/** Staff POS PIN length (matches backend StaffService + WebPOS). */
const val STAFF_PIN_LENGTH = 4
const val STAFF_PIN_MIN_LENGTH = STAFF_PIN_LENGTH
const val STAFF_PIN_MAX_LENGTH = STAFF_PIN_LENGTH

fun sanitizeStaffPinInput(raw: String): String =
    raw.filter { it.isDigit() }.take(STAFF_PIN_LENGTH)

fun isValidStaffPin(pin: String): Boolean {
    val trimmed = pin.trim()
    return trimmed.all { it.isDigit() } && trimmed.length == STAFF_PIN_LENGTH
}
