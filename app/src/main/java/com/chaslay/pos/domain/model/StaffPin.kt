package com.chaslay.pos.domain.model

/** Staff POS PIN length (matches backend StaffService + dashboard staff forms). */
const val STAFF_PIN_MIN_LENGTH = 4
const val STAFF_PIN_MAX_LENGTH = 8

/** Login keypad length (matches WebPOS PIN gate: 4 digits, auto-submit). */
const val STAFF_PIN_QUICK_LOGIN_LENGTH = 4

fun sanitizeStaffPinInput(raw: String): String =
    raw.filter { it.isDigit() }.take(STAFF_PIN_MAX_LENGTH)

fun isValidStaffPin(pin: String): Boolean {
    val trimmed = pin.trim()
    return trimmed.all { it.isDigit() } &&
        trimmed.length in STAFF_PIN_MIN_LENGTH..STAFF_PIN_MAX_LENGTH
}
