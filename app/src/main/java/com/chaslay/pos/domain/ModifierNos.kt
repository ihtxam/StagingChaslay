package com.chaslay.pos.domain

/** Matches backend/dashboard `modifier-nos` and `shop-modifier-utils` naming rules. */
object ModifierNos {
    private fun normalizeGroupKey(title: String): String =
        title.trim().lowercase()
            .replace('\u2018', '\'')
            .replace('\u2019', '\'')

    fun isNosModifierGroup(title: String): Boolean {
        val key = normalizeGroupKey(title)
        return key == "no's" || key == "nos" || key == "no" || key == "removals"
    }

    fun isExtrasModifierGroup(title: String): Boolean {
        val key = normalizeGroupKey(title)
        return key == "extras" || key == "extra" || key == "suppléments" || key == "supplements"
    }

    /** True when a cart line label is a removal / exclusion (No tomato, No onions, …). */
    fun isNosModifierLabel(name: String): Boolean {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return false
        return Regex("^no[\\s\\-.]", RegexOption.IGNORE_CASE).containsMatchIn(trimmed) ||
            trimmed.equals("no", ignoreCase = true)
    }
}
