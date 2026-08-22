"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDeliveryPlatformSettings = normalizeDeliveryPlatformSettings;
exports.getDeliveryPlatformPublic = getDeliveryPlatformPublic;
exports.mergeDeliveryPlatformSettings = mergeDeliveryPlatformSettings;
exports.applyProductionCredentialDefaults = applyProductionCredentialDefaults;
exports.orderSourceFromPlatform = orderSourceFromPlatform;
exports.platformKeyFromSource = platformKeyFromSource;
function maskSecret(value) {
    if (!value)
        return null;
    if (value.length <= 8)
        return "••••••••";
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
function isMasked(value) {
    return !!value && value.includes("••••");
}
function normalizeCreds(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    return {
        enabled: o.enabled === true,
        testMode: o.testMode === true,
        storeId: o.storeId != null ? String(o.storeId).trim() || null : null,
        apiKey: o.apiKey != null ? String(o.apiKey).trim() || null : null,
        apiSecret: o.apiSecret != null ? String(o.apiSecret).trim() || null : null,
        clientId: o.clientId != null ? String(o.clientId).trim() || null : null,
        clientSecret: o.clientSecret != null ? String(o.clientSecret).trim() || null : null,
        webhookSecret: o.webhookSecret != null ? String(o.webhookSecret).trim() || null : null,
        autoAccept: o.autoAccept === true,
    };
}
function normalizeDeliveryPlatformSettings(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    return {
        justEat: normalizeCreds(o.justEat),
        uberEats: normalizeCreds(o.uberEats),
    };
}
function getDeliveryPlatformPublic(raw) {
    const norm = normalizeDeliveryPlatformSettings(raw);
    const je = norm.justEat || {};
    const ue = norm.uberEats || {};
    return {
        justEat: {
            ...je,
            apiKey: undefined,
            apiSecret: undefined,
            webhookSecret: undefined,
            apiKeySet: !!je.apiKey,
            apiKeyMasked: maskSecret(je.apiKey),
            apiSecretSet: !!je.apiSecret,
            apiSecretMasked: maskSecret(je.apiSecret),
            webhookSecretSet: !!je.webhookSecret,
            webhookSecretMasked: maskSecret(je.webhookSecret),
        },
        uberEats: {
            ...ue,
            clientSecret: undefined,
            webhookSecret: undefined,
            clientSecretSet: !!ue.clientSecret,
            clientSecretMasked: maskSecret(ue.clientSecret),
            webhookSecretSet: !!ue.webhookSecret,
            webhookSecretMasked: maskSecret(ue.webhookSecret),
        },
    };
}
function mergeDeliveryPlatformSettings(prevRaw, updatesRaw) {
    const prev = normalizeDeliveryPlatformSettings(prevRaw);
    const updates = normalizeDeliveryPlatformSettings(updatesRaw);
    const mergeOne = (key, patch) => {
        const base = prev[key] || {};
        const next = patch || {};
        const out = {
            ...base,
            ...next,
        };
        if (isMasked(next.apiKey))
            out.apiKey = base.apiKey;
        if (isMasked(next.apiSecret))
            out.apiSecret = base.apiSecret;
        if (isMasked(next.clientSecret))
            out.clientSecret = base.clientSecret;
        if (isMasked(next.webhookSecret))
            out.webhookSecret = base.webhookSecret;
        return out;
    };
    return {
        justEat: mergeOne("justEat", updates.justEat),
        uberEats: mergeOne("uberEats", updates.uberEats),
    };
}
/** Production API credentials present → live webhooks (test mode off). */
function applyProductionCredentialDefaults(settings) {
    const je = settings.justEat || {};
    const ue = settings.uberEats || {};
    return {
        justEat: {
            ...je,
            // JET Connect: REST API key + webhook HMAC secret = live mode
            testMode: je.apiKey && je.webhookSecret ? false : je.testMode,
        },
        uberEats: {
            ...ue,
            testMode: ue.clientId && ue.clientSecret ? false : ue.testMode,
        },
    };
}
function orderSourceFromPlatform(platform) {
    const p = String(platform || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-");
    if (p === "just-eat" || p === "justeat")
        return "justeat";
    if (p === "uber-eats" || p === "ubereats")
        return "ubereats";
    if (p === "online-shop" || p === "online_shop" || p === "web-shop")
        return "online_shop";
    return null;
}
function platformKeyFromSource(source) {
    if (source === "justeat")
        return "justEat";
    if (source === "ubereats")
        return "uberEats";
    return null;
}
//# sourceMappingURL=delivery-platform-settings.js.map