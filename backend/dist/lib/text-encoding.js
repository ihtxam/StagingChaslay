"use strict";
/** Catalog text normalization and mojibake repair (UTF-8 read as Latin-1). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairUtf8Mojibake = repairUtf8Mojibake;
exports.normalizeDashes = normalizeDashes;
exports.normalizeCatalogText = normalizeCatalogText;
exports.repairCatalogText = repairCatalogText;
/**
 * Dash / hyphen lookalikes ? ASCII hyphen-minus (U+002D).
 * Includes en/em/minus, fullwidth, soft hyphen, and C1 bytes (U+0096/97/9D)
 * that appear when Windows-1252 dashes were mis-decoded.
 */
const DASH_LIKE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D\u00AD\u2043\u0096\u0097\u009D\uFFFD]/g;
/** Fix UTF-8 bytes mis-read as ISO-8859-1 (e.g. Snacké ? Snack�). */
function repairUtf8Mojibake(text) {
    if (!text.includes("\u00C3") && !text.includes("\u00C2") && !text.includes("\uFFFD")) {
        return text;
    }
    try {
        const bytes = Buffer.from(text, "latin1");
        const repaired = bytes.toString("utf8");
        return repaired.includes("\uFFFD") ? text : repaired;
    }
    catch {
        return text;
    }
}
/** Fold en/em/minus/etc. to ASCII `-` so printers and latin1 paths never emit `?`. */
function normalizeDashes(text) {
    return text.replace(DASH_LIKE, "-");
}
/** NFC + diameter symbols + ASCII dashes for catalog and print. */
function normalizeCatalogText(text) {
    return normalizeDashes(text.replace(/\u2300|\u2205/g, "\u00D8")).normalize("NFC");
}
function repairCatalogText(text) {
    return normalizeCatalogText(repairUtf8Mojibake(String(text || "").trim()));
}
//# sourceMappingURL=text-encoding.js.map