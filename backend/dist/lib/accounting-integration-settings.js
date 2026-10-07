"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAccountingIntegrationSettings = normalizeAccountingIntegrationSettings;
exports.getAccountingIntegrationPublic = getAccountingIntegrationPublic;
exports.mergeAccountingIntegrationSettings = mergeAccountingIntegrationSettings;
exports.defaultAccountingAccountMap = defaultAccountingAccountMap;
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
function normalizeAccountMap(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    const pick = (k) => {
        const v = o[k];
        if (v == null)
            return null;
        const s = String(v).trim();
        return s || null;
    };
    return {
        salesRevenue: pick("salesRevenue"),
        vatPayable: pick("vatPayable"),
        cash: pick("cash"),
        cardClearing: pick("cardClearing"),
        terminalClearing: pick("terminalClearing"),
        tips: pick("tips"),
        discounts: pick("discounts"),
        refunds: pick("refunds"),
    };
}
function normalizeBexio(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    const vatRaw = o.vatCodeByLabel;
    const vatCodeByLabel = {};
    if (vatRaw && typeof vatRaw === "object") {
        for (const [k, v] of Object.entries(vatRaw)) {
            if (v != null && String(v).trim())
                vatCodeByLabel[k] = String(v).trim();
        }
    }
    return {
        enabled: o.enabled === true,
        syncMode: o.syncMode === "api" ? "api" : "export_only",
        personalAccessToken: o.personalAccessToken != null ? String(o.personalAccessToken).trim() || null : null,
        oauthAccessToken: o.oauthAccessToken != null ? String(o.oauthAccessToken).trim() || null : null,
        oauthRefreshToken: o.oauthRefreshToken != null ? String(o.oauthRefreshToken).trim() || null : null,
        oauthExpiresAt: o.oauthExpiresAt != null ? String(o.oauthExpiresAt) : null,
        oauthScope: o.oauthScope != null ? String(o.oauthScope).trim() || null : null,
        oauthConnectedAt: o.oauthConnectedAt != null ? String(o.oauthConnectedAt) : null,
        referencePrefix: o.referencePrefix != null ? String(o.referencePrefix).trim().slice(0, 40) || null : null,
        accounts: normalizeAccountMap(o.accounts),
        vatCodeByLabel,
        lastPushedReference: o.lastPushedReference != null ? String(o.lastPushedReference).trim() || null : null,
        lastPushedAt: o.lastPushedAt != null ? String(o.lastPushedAt) : null,
        lastPushError: o.lastPushError != null ? String(o.lastPushError).slice(0, 500) : null,
    };
}
function normalizeOdoo(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    return {
        enabled: o.enabled === true,
        syncMode: o.syncMode === "api" ? "api" : "export_only",
        baseUrl: o.baseUrl != null ? String(o.baseUrl).trim().replace(/\/$/, "") || null : null,
        database: o.database != null ? String(o.database).trim() || null : null,
        username: o.username != null ? String(o.username).trim() || null : null,
        apiKey: o.apiKey != null ? String(o.apiKey).trim() || null : null,
        journalCode: o.journalCode != null ? String(o.journalCode).trim().slice(0, 20) || null : null,
        accounts: normalizeAccountMap(o.accounts),
        lastPushedReference: o.lastPushedReference != null ? String(o.lastPushedReference).trim() || null : null,
        lastPushedAt: o.lastPushedAt != null ? String(o.lastPushedAt) : null,
        lastPushError: o.lastPushError != null ? String(o.lastPushError).slice(0, 500) : null,
    };
}
function normalizeAccountingIntegrationSettings(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    return {
        bexio: normalizeBexio(o.bexio),
        odoo: normalizeOdoo(o.odoo),
    };
}
function getAccountingIntegrationPublic(raw) {
    const norm = normalizeAccountingIntegrationSettings(raw);
    const bexio = norm.bexio || {};
    const odoo = norm.odoo || {};
    return {
        bexio: {
            ...bexio,
            personalAccessToken: undefined,
            oauthAccessToken: undefined,
            oauthRefreshToken: undefined,
            personalAccessTokenSet: !!bexio.personalAccessToken,
            personalAccessTokenMasked: maskSecret(bexio.personalAccessToken),
            oauthConnected: !!(bexio.oauthRefreshToken || bexio.oauthAccessToken),
            oauthConnectedAt: bexio.oauthConnectedAt || null,
        },
        odoo: {
            ...odoo,
            apiKey: undefined,
            apiKeySet: !!odoo.apiKey,
            apiKeyMasked: maskSecret(odoo.apiKey),
        },
    };
}
function mergeAccountingIntegrationSettings(prevRaw, updatesRaw) {
    const prev = normalizeAccountingIntegrationSettings(prevRaw);
    const updates = normalizeAccountingIntegrationSettings(updatesRaw);
    const mergeBexio = () => {
        const base = prev.bexio || {};
        const next = updates.bexio || {};
        const out = {
            ...base,
            ...next,
            accounts: { ...base.accounts, ...next.accounts },
            vatCodeByLabel: { ...base.vatCodeByLabel, ...next.vatCodeByLabel },
        };
        if (isMasked(next.personalAccessToken)) {
            out.personalAccessToken = base.personalAccessToken;
        }
        return out;
    };
    const mergeOdoo = () => {
        const base = prev.odoo || {};
        const next = updates.odoo || {};
        const out = {
            ...base,
            ...next,
            accounts: { ...base.accounts, ...next.accounts },
        };
        if (isMasked(next.apiKey)) {
            out.apiKey = base.apiKey;
        }
        return out;
    };
    return {
        bexio: mergeBexio(),
        odoo: mergeOdoo(),
    };
}
function defaultAccountingAccountMap() {
    return {
        salesRevenue: "3200",
        vatPayable: "2200",
        cash: "1000",
        cardClearing: "1020",
        terminalClearing: "1021",
        tips: "3900",
        discounts: "3800",
        refunds: "3200",
    };
}
//# sourceMappingURL=accounting-integration-settings.js.map