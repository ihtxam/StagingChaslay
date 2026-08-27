"use strict";
/** Cloud POS / WebPOS receipt + printer settings (shared with Android later). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POS_REFUND_REASONS = exports.POS_CANCEL_REASONS = exports.DEFAULT_POS_PRINT_SETTINGS = exports.KITCHEN_PRINT_DESTINATIONS = void 0;
exports.normalizePosPrintSettings = normalizePosPrintSettings;
exports.migrateKitchenPrintRoutingToPrinters = migrateKitchenPrintRoutingToPrinters;
exports.resolvePosCancelReason = resolvePosCancelReason;
exports.resolvePosRefundReason = resolvePosRefundReason;
exports.KITCHEN_PRINT_DESTINATIONS = [
    "kitchen1",
    "kitchen2",
    "receipt",
    "none",
];
exports.DEFAULT_POS_PRINT_SETTINGS = {
    receiptHeader: "",
    receiptFooter: "Merci / Danke / Thank you",
    kitchenTicketHeader: "",
    kitchenTicketFooter: "",
    kitchenItemTextScale: 1,
    kitchenHeaderTextScale: 1,
    kitchenBoldText: false,
    receiptShowVatTable: true,
    receiptShowStaffLine: true,
    receiptShowQrCode: true,
    receiptDeliveryDirectionsQr: true,
    adyenReceiptDigitalOnly: false,
    paperWidthMm: 80,
    receiptLanguage: "panel",
    receiptLogoUrl: null,
    receiptLogoWidthPx: 200,
    autoPrintReceipt: true,
    autoPrintKitchen: true,
    waiterTillBellEnabled: true,
    kitchenPrintRetryEnabled: true,
    kitchenPrintRetryAttempts: 5,
    kitchenPrintRetryIntervalSec: 5,
    scaleComPort: null,
    scaleDeviceName: null,
    scaleDeviceId: null,
    scaleUsbAddress: null,
    scaleEnabled: false,
    printers: [],
    labelWidthMm: 40,
    labelHeightMm: 20,
    labelShowStoreName: true,
    labelShowProductName: true,
    labelShowBarcodeNumber: true,
    labelShowPrice: false,
    labelShowSku: false,
};
function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}
function normalizePosPrintSettings(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const paper = Number(src.paperWidthMm) === 58 ? 58 : 80;
    const lang = String(src.receiptLanguage || "panel").toLowerCase();
    const receiptLanguage = ["en", "fr", "de", "panel"].includes(lang)
        ? lang
        : "panel";
    const printersRaw = Array.isArray(src.printers) ? src.printers : [];
    const printers = printersRaw
        .map((p, i) => {
        if (!p || typeof p !== "object")
            return null;
        const row = p;
        const name = String(row.name || "").trim().slice(0, 200);
        if (!name)
            return null;
        return {
            id: String(row.id || `p-${i}-${Date.now()}`).slice(0, 64),
            name,
            portName: row.portName == null || row.portName === undefined
                ? null
                : String(row.portName).trim().slice(0, 80) || null,
            matchHint: row.matchHint == null || row.matchHint === undefined
                ? null
                : String(row.matchHint).trim().slice(0, 200) || null,
            enabled: row.enabled !== false,
            paperWidthMm: Number(row.paperWidthMm) === 58 ? 58 : 80,
            printReceipts: !!row.printReceipts,
            printKitchenTickets: !!row.printKitchenTickets,
            printEndOfDayReports: !!row.printEndOfDayReports,
            printLabels: !!row.printLabels,
            printAllProducts: row.printAllProducts !== false,
            linkedCategoryIds: Array.isArray(row.linkedCategoryIds)
                ? row.linkedCategoryIds.map(String).slice(0, 200)
                : [],
            linkedProductIds: Array.isArray(row.linkedProductIds)
                ? row.linkedProductIds.map(String).slice(0, 500)
                : [],
        };
    })
        .filter(Boolean);
    const routingDests = new Set(exports.KITCHEN_PRINT_DESTINATIONS);
    let kitchenPrintRouting;
    if (src.kitchenPrintRouting && typeof src.kitchenPrintRouting === "object") {
        const rawRouting = src.kitchenPrintRouting;
        const next = {};
        for (const [catId, dest] of Object.entries(rawRouting)) {
            const id = String(catId || "").trim().slice(0, 64);
            const d = String(dest || "").trim();
            if (id && routingDests.has(d)) {
                next[id] = d;
            }
        }
        if (Object.keys(next).length)
            kitchenPrintRouting = next;
    }
    let kitchenExcludedCategoryIds;
    if (Array.isArray(src.kitchenExcludedCategoryIds)) {
        const ids = src.kitchenExcludedCategoryIds.map(String).filter(Boolean).slice(0, 200);
        if (ids.length)
            kitchenExcludedCategoryIds = ids;
    }
    const migrated = migrateKitchenPrintRoutingToPrinters(printers, kitchenPrintRouting, kitchenExcludedCategoryIds);
    const labelWidthMm = Number(src.labelWidthMm) === 58 ? 58 : 40;
    const rawH = Number(src.labelHeightMm);
    const labelHeightMm = (rawH === 25 || rawH === 30 || rawH === 40 ? rawH : 20);
    const itemScale = Number(src.kitchenItemTextScale);
    const headerScale = Number(src.kitchenHeaderTextScale);
    let kitchenItemTextScale = (itemScale === 1 || itemScale === 2 || itemScale === 3 ? itemScale : 1);
    let kitchenHeaderTextScale = (headerScale === 1 || headerScale === 2 || headerScale === 3
        ? headerScale
        : 1);
    let kitchenBoldText = src.kitchenBoldText === true;
    // Legacy default was double-height (2) + bold — migrate to plain full-width tickets.
    if (kitchenItemTextScale === 2 && kitchenHeaderTextScale === 2 && src.kitchenBoldText !== false) {
        kitchenItemTextScale = 1;
        kitchenHeaderTextScale = 1;
        kitchenBoldText = false;
    }
    return {
        receiptHeader: String(src.receiptHeader ?? "").slice(0, 2000),
        receiptFooter: String(src.receiptFooter ?? exports.DEFAULT_POS_PRINT_SETTINGS.receiptFooter).slice(0, 2000),
        kitchenTicketHeader: String(src.kitchenTicketHeader ?? "").slice(0, 2000),
        kitchenTicketFooter: String(src.kitchenTicketFooter ?? "").slice(0, 2000),
        kitchenItemTextScale,
        kitchenHeaderTextScale,
        kitchenBoldText,
        receiptShowVatTable: src.receiptShowVatTable !== false,
        receiptShowStaffLine: src.receiptShowStaffLine !== false,
        receiptShowQrCode: src.receiptShowQrCode !== false,
        receiptDeliveryDirectionsQr: src.receiptDeliveryDirectionsQr !== false,
        adyenReceiptDigitalOnly: src.adyenReceiptDigitalOnly === true,
        paperWidthMm: paper,
        receiptLanguage,
        receiptLogoUrl: src.receiptLogoUrl === null || src.receiptLogoUrl === undefined
            ? null
            : String(src.receiptLogoUrl).trim().slice(0, 500) || null,
        receiptLogoWidthPx: clampInt(src.receiptLogoWidthPx, 48, 200, exports.DEFAULT_POS_PRINT_SETTINGS.receiptLogoWidthPx),
        autoPrintReceipt: src.autoPrintReceipt !== false,
        autoPrintKitchen: src.autoPrintKitchen !== false,
        waiterTillBellEnabled: src.waiterTillBellEnabled !== false,
        kitchenPrintRetryEnabled: src.kitchenPrintRetryEnabled !== false,
        kitchenPrintRetryAttempts: clampInt(src.kitchenPrintRetryAttempts, 1, 20, 5),
        kitchenPrintRetryIntervalSec: clampInt(src.kitchenPrintRetryIntervalSec, 2, 60, 5),
        scaleComPort: src.scaleComPort === null || src.scaleComPort === undefined
            ? null
            : String(src.scaleComPort).trim().slice(0, 80) || null,
        scaleDeviceName: src.scaleDeviceName === null || src.scaleDeviceName === undefined
            ? null
            : String(src.scaleDeviceName).trim().slice(0, 200) || null,
        scaleDeviceId: src.scaleDeviceId === null || src.scaleDeviceId === undefined
            ? null
            : String(src.scaleDeviceId).trim().slice(0, 240) || null,
        scaleUsbAddress: src.scaleUsbAddress === null || src.scaleUsbAddress === undefined
            ? null
            : String(src.scaleUsbAddress).trim().slice(0, 120) || null,
        scaleEnabled: src.scaleEnabled === true,
        printers: migrated.printers,
        kitchenPrintRouting: migrated.routing,
        kitchenExcludedCategoryIds: migrated.excludedCategoryIds,
        labelWidthMm,
        labelHeightMm,
        labelShowStoreName: src.labelShowStoreName !== false,
        labelShowProductName: src.labelShowProductName !== false,
        labelShowBarcodeNumber: src.labelShowBarcodeNumber !== false,
        labelShowPrice: src.labelShowPrice === true,
        labelShowSku: src.labelShowSku === true,
    };
}
/** One-time migration: category→destination map → per-printer linkedCategoryIds (Android-aligned). */
function migrateKitchenPrintRoutingToPrinters(printers, routing, existingExcluded) {
    if (!routing || !Object.keys(routing).length) {
        return { printers, routing, excludedCategoryIds: existingExcluded };
    }
    const result = printers.map((p) => ({ ...p }));
    const kitchenIndices = result
        .map((p, i) => (p.printKitchenTickets ? i : -1))
        .filter((i) => i >= 0);
    const receiptIndices = result
        .map((p, i) => (p.printReceipts ? i : -1))
        .filter((i) => i >= 0);
    const byDest = {
        kitchen1: [],
        kitchen2: [],
        receipt: [],
        none: [],
    };
    for (const [catId, dest] of Object.entries(routing)) {
        byDest[dest]?.push(catId);
    }
    const excluded = new Set([...(existingExcluded || []), ...byDest.none]);
    if (kitchenIndices[1] !== undefined && byDest.kitchen2.length) {
        const idx = kitchenIndices[1];
        result[idx] = {
            ...result[idx],
            printAllProducts: false,
            linkedCategoryIds: [...new Set(byDest.kitchen2)],
        };
    }
    if (byDest.receipt.length && receiptIndices.length) {
        for (const idx of receiptIndices) {
            const p = result[idx];
            result[idx] = {
                ...p,
                printKitchenTickets: true,
                printAllProducts: false,
                linkedCategoryIds: [...new Set([...(p.linkedCategoryIds || []), ...byDest.receipt])],
            };
        }
    }
    const migratedExplicitly = byDest.kitchen2.length > 0 || byDest.receipt.length > 0 || byDest.none.length > 0;
    return {
        printers: result,
        routing: migratedExplicitly ? undefined : routing,
        excludedCategoryIds: excluded.size ? [...excluded] : existingExcluded,
    };
}
exports.POS_CANCEL_REASONS = [
    { id: "kitchen_busy", en: "Kitchen too busy", fr: "Cuisine trop occupée", de: "Küche überlastet" },
    { id: "client_cancel", en: "Client cancellation", fr: "Annulation client", de: "Stornierung durch Gast" },
    { id: "out_of_stock", en: "Out of stock", fr: "Rupture de stock", de: "Nicht vorrätig" },
    { id: "wrong_order", en: "Wrong order entered", fr: "Mauvaise commande saisie", de: "Falsche Bestellung erfasst" },
    { id: "could_not_process", en: "Could not process order", fr: "Impossible de traiter la commande", de: "Bestellung konnte nicht verarbeitet werden" },
    { id: "other", en: "Other", fr: "Autre", de: "Sonstiges" },
];
function resolvePosCancelReason(reason) {
    const raw = String(reason || "").trim();
    if (!raw)
        return "";
    const lower = raw.toLowerCase();
    const matched = exports.POS_CANCEL_REASONS.find((r) => r.id === lower ||
        r.en.toLowerCase() === lower ||
        r.fr.toLowerCase() === lower ||
        r.de.toLowerCase() === lower);
    return (matched ? matched.en : raw).slice(0, 500);
}
exports.POS_REFUND_REASONS = [
    {
        id: "didnt_like_food",
        en: "Client didn't like the food",
        fr: "Le client n'a pas aimé le plat",
        de: "Gast mochte das Essen nicht",
    },
    {
        id: "service_slow",
        en: "Service was slow",
        fr: "Service trop lent",
        de: "Service war zu langsam",
    },
    {
        id: "wrong_order",
        en: "Wrong order",
        fr: "Mauvaise commande",
        de: "Falsche Bestellung",
    },
    {
        id: "change_of_mind",
        en: "Change of mind",
        fr: "Changement d'avis",
        de: "Meinungsänderung",
    },
    {
        id: "quality_issue",
        en: "Quality / preparation issue",
        fr: "Problème de qualité / préparation",
        de: "Qualitäts- / Zubereitungsproblem",
    },
    { id: "other", en: "Other (custom)", fr: "Autre (personnalisé)", de: "Sonstiges (frei)" },
];
function resolvePosRefundReason(reason) {
    const raw = String(reason || "").trim();
    if (!raw)
        return "";
    const lower = raw.toLowerCase();
    const matched = exports.POS_REFUND_REASONS.find((r) => r.id === lower ||
        r.en.toLowerCase() === lower ||
        r.fr.toLowerCase() === lower ||
        r.de.toLowerCase() === lower);
    // Custom messages keep the typed text; presets normalize to English.
    if (matched && matched.id !== "other")
        return matched.en.slice(0, 500);
    return raw.slice(0, 500);
}
//# sourceMappingURL=pos-print-settings.js.map