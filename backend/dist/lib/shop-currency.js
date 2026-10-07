"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferShopCurrency = inferShopCurrency;
exports.formatShopMoney = formatShopMoney;
/** Infer display/checkout currency for a merchant shop (no DB column yet). */
function inferShopCurrency(input) {
    const explicit = String(input?.currency || "")
        .trim()
        .toUpperCase();
    if (/^[A-Z]{3}$/.test(explicit))
        return explicit;
    const country = String(input?.country || "")
        .trim()
        .toUpperCase()
        .replace(/^UNITED KINGDOM$/i, "GB")
        .slice(0, 2);
    const eur = new Set([
        "DE",
        "AT",
        "FR",
        "IT",
        "LU",
        "ES",
        "PT",
        "IE",
        "NL",
        "BE",
        "FI",
        "GR",
        "SK",
        "SI",
        "EE",
        "LV",
        "LT",
        "CY",
        "MT",
        "HR",
    ]);
    if (eur.has(country))
        return "EUR";
    if (country === "GB" || country === "UK")
        return "GBP";
    if (country === "US")
        return "USD";
    return "CHF";
}
function formatShopMoney(amount, currency, locale) {
    const code = String(currency || "CHF")
        .trim()
        .toUpperCase()
        .slice(0, 3);
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    try {
        return new Intl.NumberFormat(locale || undefined, {
            style: "currency",
            currency: code,
        }).format(value);
    }
    catch {
        return `${code} ${value.toFixed(2)}`;
    }
}
//# sourceMappingURL=shop-currency.js.map