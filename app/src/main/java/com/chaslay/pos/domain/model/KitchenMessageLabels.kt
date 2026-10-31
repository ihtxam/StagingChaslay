package com.chaslay.pos.domain.model

/** Localized text for kitchen bump tickets (uses business default language). */
object KitchenMessageLabels {

    fun orderCancelled(languageCode: String, reason: String): String =
        format(languageCode, ::orderCancelledEn, ::orderCancelledFr, ::orderCancelledDe, ::orderCancelledIt, reason)

    fun tableMovedFrom(languageCode: String, sourceTableName: String): String =
        format(languageCode, ::tableMovedEn, ::tableMovedFr, ::tableMovedDe, ::tableMovedIt, sourceTableName)

    fun mergedFrom(languageCode: String, sourceTableName: String, itemCount: Int): String =
        when (AppLanguage.fromCode(languageCode)) {
            AppLanguage.FRENCH -> "Fusion depuis $sourceTableName ($itemCount article(s))"
            AppLanguage.GERMAN -> "Zusammengeführt von $sourceTableName ($itemCount Artikel)"
            AppLanguage.ITALIAN -> "Unito da $sourceTableName ($itemCount articolo/i)"
            else -> "Merged from $sourceTableName ($itemCount item(s))"
        }

    fun fromTable(languageCode: String, sourceTableName: String, itemSummary: String): String =
        when (AppLanguage.fromCode(languageCode)) {
            AppLanguage.FRENCH -> "Depuis $sourceTableName : $itemSummary"
            AppLanguage.GERMAN -> "Von $sourceTableName: $itemSummary"
            AppLanguage.ITALIAN -> "Da $sourceTableName: $itemSummary"
            else -> "From $sourceTableName: $itemSummary"
        }

    private fun format(
        languageCode: String,
        en: (String) -> String,
        fr: (String) -> String,
        de: (String) -> String,
        it: (String) -> String,
        arg: String
    ): String = when (AppLanguage.fromCode(languageCode)) {
        AppLanguage.FRENCH -> fr(arg)
        AppLanguage.GERMAN -> de(arg)
        AppLanguage.ITALIAN -> it(arg)
        else -> en(arg)
    }

    private fun orderCancelledEn(reason: String) = "ORDER CANCELLED: $reason"
    private fun orderCancelledFr(reason: String) = "COMMANDE ANNULÉE : $reason"
    private fun orderCancelledDe(reason: String) = "BESTELLUNG STORNIERT: $reason"
    private fun orderCancelledIt(reason: String) = "ORDINE ANNULLATO: $reason"

    private fun tableMovedEn(name: String) = "Table moved from $name"
    private fun tableMovedFr(name: String) = "Table déplacée depuis $name"
    private fun tableMovedDe(name: String) = "Tisch verschoben von $name"
    private fun tableMovedIt(name: String) = "Tavolo spostato da $name"
}
