"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiskalyFrService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const money_1 = require("@/lib/money");
const FR_API_VERSION = "2026-02-03";
const tokenCache = new Map();
function frBaseUrl(environment) {
    const host = environment === "live" ? "https://live.api.fiskaly.com" : "https://test.api.fiskaly.com";
    return `${host}/api/v1`;
}
function cacheKey(apiKey, environment) {
    return `${environment}:${apiKey}`;
}
function frHeaders(token, unitId, idempotencyKey) {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Api-Version": FR_API_VERSION,
        "X-Scope-Identifier": unitId,
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    };
}
function formatMoney(amount) {
    return (0, money_1.roundMoney2)(amount).toFixed(2);
}
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
function buildEntries(sale) {
    const items = Array.isArray(sale.items) ? sale.items.filter((i) => (Number(i.totalPrice) || 0) > 0) : [];
    if (items.length) {
        return items.map((item, idx) => {
            const totalIncl = Number(item.totalPrice) || 0;
            const tax = Number(item.taxAmount) || 0;
            const totalExcl = Math.max(0, totalIncl - tax);
            const rate = item.taxRate != null && Number.isFinite(Number(item.taxRate))
                ? Number(item.taxRate)
                : totalExcl > 0
                    ? (tax / totalExcl) * 100
                    : 20;
            const qty = Number(item.quantity) || 1;
            const unitIncl = qty > 0 ? totalIncl / qty : totalIncl;
            return {
                type: "SALE",
                description: String(item.productName || `Item ${idx + 1}`).slice(0, 200),
                nature: "GOOD",
                quantity: String(qty),
                amounts: {
                    unit_including_vat: formatMoney(unitIncl),
                    total_including_vat: formatMoney(totalIncl),
                    total_excluding_vat: formatMoney(totalExcl),
                    vat: { rate: formatMoney(rate), amount: formatMoney(tax) },
                },
            };
        });
    }
    const totalIncl = Number(sale.total) || 0;
    const tax = Number(sale.taxAmount) || 0;
    const totalExcl = Math.max(0, totalIncl - tax);
    const rate = totalExcl > 0 ? (tax / totalExcl) * 100 : 20;
    return [
        {
            type: "SALE",
            description: "POS sale",
            nature: "GOOD",
            quantity: "1",
            amounts: {
                unit_including_vat: formatMoney(totalIncl),
                total_including_vat: formatMoney(totalIncl),
                total_excluding_vat: formatMoney(totalExcl),
                vat: { rate: formatMoney(rate), amount: formatMoney(tax) },
            },
        },
    ];
}
class FiskalyFrService {
    static async authenticate(apiKey, apiSecret, environment = "test") {
        const key = cacheKey(apiKey, environment);
        const cached = tokenCache.get(key);
        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }
        const base = frBaseUrl(environment);
        const { data } = await axios_1.default.post(`${base}/tokens`, {
            content: {
                type: "API_KEY",
                key: apiKey,
                secret: apiSecret,
            },
        }, {
            headers: { "Content-Type": "application/json", "X-Api-Version": FR_API_VERSION },
            timeout: 20000,
            validateStatus: () => true,
        });
        const bearer = String(data?.content?.authentication?.bearer || "").trim();
        if (!bearer) {
            const msg = data?.content?.message || data?.message || "Fiskaly FR authentication failed";
            throw new Error(String(msg));
        }
        const expiresAtRaw = data?.content?.authentication?.expires_at;
        const expiresAt = expiresAtRaw ? Date.parse(String(expiresAtRaw)) : Date.now() + 23 * 60 * 60 * 1000;
        tokenCache.set(key, { token: bearer, expiresAt });
        return bearer;
    }
    static async testConnection(fr, environment) {
        if (!fr.apiKey || !fr.apiSecret)
            throw new Error("API key and secret are required");
        if (!fr.unitId)
            throw new Error("Unit ID (X-Scope-Identifier) is required");
        await this.authenticate(fr.apiKey, fr.apiSecret, environment);
    }
    static async signTransaction(opts) {
        const { fr, environment, sale } = opts;
        if (!fr.apiKey || !fr.apiSecret)
            throw new Error("Fiskaly FR credentials missing");
        if (!fr.unitId)
            throw new Error("Fiskaly FR unit ID is required");
        if (!fr.systemId)
            throw new Error("Fiskaly FR system ID is required");
        const token = await this.authenticate(fr.apiKey, fr.apiSecret, environment);
        const base = frBaseUrl(environment);
        const unitId = fr.unitId;
        const intentionRes = await axios_1.default.post(`${base}/records`, {
            content: {
                type: "INTENTION",
                system: { id: fr.systemId },
                operation: { type: "TRANSACTION" },
            },
        }, {
            headers: frHeaders(token, unitId, (0, crypto_1.randomUUID)()),
            timeout: 30000,
            validateStatus: () => true,
        });
        const intentionBody = intentionRes.data;
        const intentionId = String(intentionBody?.content?.id || intentionBody?.id || "").trim();
        if (!intentionId) {
            throw new Error(intentionBody?.content?.message ||
                intentionBody?.message ||
                "Fiskaly FR INTENTION failed");
        }
        const totalIncl = Number(sale.total) || 0;
        const tax = Number(sale.taxAmount) || 0;
        const totalExcl = Math.max(0, totalIncl - tax);
        const docNumber = String(sale.orderNumber || (0, crypto_1.randomUUID)().slice(0, 8)).slice(0, 40);
        const txRes = await axios_1.default.post(`${base}/records`, {
            content: {
                type: "TRANSACTION",
                intention: { id: intentionId },
                operation: {
                    type: "RECEIPT",
                    document: {
                        number: docNumber,
                        date: todayIsoDate(),
                        amounts: {
                            total_including_vat: formatMoney(totalIncl),
                            total_excluding_vat: formatMoney(totalExcl),
                        },
                    },
                    entries: buildEntries(sale),
                },
            },
        }, {
            headers: frHeaders(token, unitId, (0, crypto_1.randomUUID)()),
            timeout: 30000,
            validateStatus: () => true,
        });
        const body = txRes.data;
        const content = body?.content || body;
        const txId = String(content?.id || (0, crypto_1.randomUUID)()).trim();
        const signature = content?.signature?.value != null
            ? String(content.signature.value)
            : content?.fiscalization?.signature != null
                ? String(content.fiscalization.signature)
                : null;
        const qrCodeData = content?.qr_code_data != null
            ? String(content.qr_code_data)
            : content?.fiscalization?.qr_code != null
                ? String(content.fiscalization.qr_code)
                : null;
        const txNumber = content?.document?.number ?? docNumber;
        return {
            signature,
            qrCodeData,
            txNumber,
            txId,
            intentionId,
            raw: body,
        };
    }
}
exports.FiskalyFrService = FiskalyFrService;
//# sourceMappingURL=fiskaly-fr.service.js.map