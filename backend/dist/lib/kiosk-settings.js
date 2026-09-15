"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_KIOSK_SETTINGS = void 0;
exports.generateKioskToken = generateKioskToken;
exports.normalizeKioskSettings = normalizeKioskSettings;
const crypto_1 = require("crypto");
exports.DEFAULT_KIOSK_SETTINGS = {
    promoSlides: [],
    enabledLanguages: ["en", "fr", "de"],
    defaultLanguage: "en",
    tableMode: "both",
    membershipScanEnabled: true,
    kioskAutoAcceptCard: true,
    kioskCashNeedsApproval: true,
    idleTimeoutSeconds: 120,
    adminPin: "1234",
    cashPaymentEnabled: true,
    cardPaymentEnabled: true,
    takeawayEnabled: true,
    deliveryEnabled: false,
    dineInEnabled: true,
    brandPrimaryColor: "#059669",
    brandSecondaryColor: "#047857",
    brandButtonTextColor: "#ffffff",
    autoPrintKitchen: true,
    autoPrintReceipt: false,
    screenSizeIn: 23,
    kioskLayout: "restaurant",
    categoryNav: "left",
};
function generateKioskToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function normalizeHexColor(value, fallback) {
    const raw = String(value ?? fallback).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw))
        return raw.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        const h = raw.slice(1);
        return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
    }
    return fallback;
}
function normalizeKioskSettings(raw) {
    if (!raw || typeof raw !== "object") {
        return {
            ...exports.DEFAULT_KIOSK_SETTINGS,
            accessToken: generateKioskToken(),
        };
    }
    const src = raw;
    const slidesRaw = src.promoSlides;
    const promoSlides = Array.isArray(slidesRaw)
        ? slidesRaw
            .map((s) => {
            if (!s || typeof s !== "object")
                return null;
            const slide = s;
            return {
                imageUrl: String(slide.imageUrl || "").trim() || undefined,
                overlayText: String(slide.overlayText || "").trim() || undefined,
                title: String(slide.title || "").trim() || undefined,
                subtitle: String(slide.subtitle || "").trim() || undefined,
            };
        })
            .filter(Boolean)
        : exports.DEFAULT_KIOSK_SETTINGS.promoSlides;
    const langsRaw = src.enabledLanguages;
    const enabledLanguages = Array.isArray(langsRaw)
        ? langsRaw.map((l) => String(l).trim().toLowerCase()).filter(Boolean)
        : [...(exports.DEFAULT_KIOSK_SETTINGS.enabledLanguages || [])];
    const tableModeRaw = String(src.tableMode || "both").toLowerCase();
    const tableMode = tableModeRaw === "table" || tableModeRaw === "badge" ? tableModeRaw : "both";
    let accessToken = String(src.accessToken || "").trim();
    if (!accessToken)
        accessToken = generateKioskToken();
    return {
        accessToken,
        name: String(src.name || "Self-order kiosk").trim() || "Self-order kiosk",
        promoSlides,
        slideBannerText: String(src.slideBannerText || "").trim() || undefined,
        enabledLanguages: enabledLanguages.length ? enabledLanguages : ["en"],
        defaultLanguage: String(src.defaultLanguage || enabledLanguages[0] || "en")
            .trim()
            .toLowerCase(),
        terminalId: src.terminalId == null ? null : String(src.terminalId).trim() || null,
        locationSlug: src.locationSlug == null ? null : String(src.locationSlug).trim().toLowerCase() || null,
        tableMode,
        membershipScanEnabled: src.membershipScanEnabled !== false,
        kioskAutoAcceptCard: src.kioskAutoAcceptCard !== false,
        kioskCashNeedsApproval: src.kioskCashNeedsApproval !== false,
        idleTimeoutSeconds: clampIdleSeconds(src.idleTimeoutSeconds),
        adminPin: normalizeAdminPin(src.adminPin),
        cashPaymentEnabled: src.cashPaymentEnabled !== false,
        cardPaymentEnabled: src.cardPaymentEnabled !== false,
        takeawayEnabled: src.takeawayEnabled !== false,
        deliveryEnabled: src.deliveryEnabled === true,
        dineInEnabled: src.dineInEnabled !== false,
        attractHeadline: String(src.attractHeadline || "").trim() || undefined,
        attractSubheadline: String(src.attractSubheadline || "").trim() || undefined,
        brandPrimaryColor: normalizeHexColor(src.brandPrimaryColor, exports.DEFAULT_KIOSK_SETTINGS.brandPrimaryColor),
        brandSecondaryColor: normalizeHexColor(src.brandSecondaryColor, exports.DEFAULT_KIOSK_SETTINGS.brandSecondaryColor),
        brandButtonTextColor: normalizeHexColor(src.brandButtonTextColor, exports.DEFAULT_KIOSK_SETTINGS.brandButtonTextColor),
        autoPrintKitchen: src.autoPrintKitchen !== false,
        autoPrintReceipt: src.autoPrintReceipt === true,
        screenSizeIn: normalizeScreenSizeIn(src.screenSizeIn),
        kioskLayout: normalizeKioskLayout(src.kioskLayout),
        categoryNav: normalizeCategoryNav(src.categoryNav, src.kioskLayout),
    };
}
function normalizeKioskLayout(value) {
    return String(value || "").toLowerCase() === "grocery" ? "grocery" : "restaurant";
}
function normalizeCategoryNav(value, layout) {
    const raw = String(value || "").toLowerCase();
    if (normalizeKioskLayout(layout) === "grocery") {
        return raw === "left" ? "left" : "bottom";
    }
    return raw === "top" ? "top" : "left";
}
function normalizeScreenSizeIn(value) {
    const n = Math.round(Number(value));
    return n === 27 ? 27 : 23;
}
function normalizeAdminPin(value) {
    const pin = String(value ?? exports.DEFAULT_KIOSK_SETTINGS.adminPin ?? "1234").replace(/\D/g, "");
    if (pin.length >= 4 && pin.length <= 8)
        return pin;
    return exports.DEFAULT_KIOSK_SETTINGS.adminPin;
}
function clampIdleSeconds(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n))
        return exports.DEFAULT_KIOSK_SETTINGS.idleTimeoutSeconds;
    return Math.min(600, Math.max(30, n));
}
//# sourceMappingURL=kiosk-settings.js.map