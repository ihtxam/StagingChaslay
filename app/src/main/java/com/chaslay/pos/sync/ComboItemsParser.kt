package com.chaslay.pos.sync

import com.google.gson.JsonElement
import com.google.gson.JsonParser

internal data class ParsedComboSlot(
    val name: String,
    val minPick: Int,
    val maxPick: Int,
    val optionRemoteIds: List<String>
)

internal fun hasComboItemsPayload(raw: JsonElement?): Boolean {
    if (raw == null || raw.isJsonNull) return false
    if (raw.isJsonArray) return raw.asJsonArray.size() > 0
    if (raw.isJsonObject) return raw.asJsonObject.entrySet().isNotEmpty()
    if (raw.isJsonPrimitive && raw.asJsonPrimitive.isString) return raw.asString.isNotBlank()
    return false
}

/** Accepts current slot JSON, snake_case, string option ids, and legacy fixed items. */
internal fun parseComboItems(raw: JsonElement?): List<ParsedComboSlot> {
    val array = comboItemsArray(raw) ?: return emptyList()
    return array.mapIndexedNotNull { idx, element ->
        if (element == null || element.isJsonNull) return@mapIndexedNotNull null
        if (element.isJsonPrimitive) {
            val id = element.asString.trim()
            if (id.isEmpty()) return@mapIndexedNotNull null
            return@mapIndexedNotNull ParsedComboSlot("Choice ${idx + 1}", 1, 1, listOf(id))
        }
        if (!element.isJsonObject) return@mapIndexedNotNull null
        val obj = element.asJsonObject
        val optionIds = linkedSetOf<String>()

        val optionsEl = firstElement(obj, "options", "products", "items")
        if (optionsEl != null && optionsEl.isJsonArray) {
            optionsEl.asJsonArray.forEach { opt ->
                optionIds.addAll(optionIdsFrom(opt))
            }
        }
        if (optionIds.isEmpty()) {
            val idsEl = firstElement(obj, "productIds", "product_ids")
            if (idsEl != null && idsEl.isJsonArray) {
                idsEl.asJsonArray.forEach { optionIds.addAll(optionIdsFrom(it)) }
            }
        }
        if (optionIds.isEmpty()) {
            firstString(obj, "productId", "product_id")?.let(optionIds::add)
        }
        if (optionIds.isEmpty()) return@mapIndexedNotNull null

        val minPick = (firstInt(obj, "minPick", "min_pick") ?: 1).coerceAtLeast(0)
        val maxPick = (firstInt(obj, "maxPick", "max_pick") ?: 1).coerceAtLeast(minPick.coerceAtLeast(1))
        val name = firstString(obj, "name")?.trim().orEmpty().ifEmpty { "Choice ${idx + 1}" }
        ParsedComboSlot(name, minPick, maxPick, optionIds.toList())
    }
}

private fun comboItemsArray(raw: JsonElement?): com.google.gson.JsonArray? {
    if (raw == null || raw.isJsonNull) return null
    if (raw.isJsonArray) return raw.asJsonArray
    if (raw.isJsonPrimitive && raw.asJsonPrimitive.isString) {
        val text = raw.asString.trim()
        if (text.isEmpty()) return null
        return runCatching { JsonParser.parseString(text).asJsonArray }.getOrNull()
    }
    return null
}

private fun optionIdsFrom(element: JsonElement?): List<String> {
    if (element == null || element.isJsonNull) return emptyList()
    if (element.isJsonPrimitive) {
        return element.asString.trim().takeIf { it.isNotEmpty() }?.let { listOf(it) }.orEmpty()
    }
    if (!element.isJsonObject) return emptyList()
    val obj = element.asJsonObject
    return listOfNotNull(
        firstString(obj, "productId", "product_id", "sourceProductId", "source_product_id", "id", "clientId", "client_id")
    )
}

private fun firstElement(obj: com.google.gson.JsonObject, vararg keys: String): JsonElement? {
    keys.forEach { key ->
        if (obj.has(key) && !obj.get(key).isJsonNull) return obj.get(key)
    }
    return null
}

private fun firstString(obj: com.google.gson.JsonObject, vararg keys: String): String? {
    keys.forEach { key ->
        val el = obj.get(key) ?: return@forEach
        if (el.isJsonNull) return@forEach
        if (el.isJsonPrimitive) {
            val value = el.asString.trim()
            if (value.isNotEmpty()) return value
        }
    }
    return null
}

private fun firstInt(obj: com.google.gson.JsonObject, vararg keys: String): Int? {
    keys.forEach { key ->
        val el = obj.get(key) ?: return@forEach
        if (el.isJsonNull || !el.isJsonPrimitive) return@forEach
        val primitive = el.asJsonPrimitive
        if (primitive.isNumber) return primitive.asInt
        if (primitive.isString) return primitive.asString.toIntOrNull()
    }
    return null
}
