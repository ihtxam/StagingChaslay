package com.chaslay.pos.domain.model

enum class PosCompactLayoutPreference {
    AUTO,
    ON,
    OFF;

    companion object {
        fun fromName(name: String?): PosCompactLayoutPreference =
            entries.find { it.name == name } ?: AUTO
    }
}