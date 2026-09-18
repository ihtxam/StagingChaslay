"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiskalyDeService = void 0;
exports.mapVatRateToFiskalyDe = mapVatRateToFiskalyDe;
exports.mapPaymentMethodToFiskalyDe = mapPaymentMethodToFiskalyDe;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const money_1 = require("@/lib/money");
const DE_BASE_URL = "https://kassensichv-middleware.fiskaly.com/api/v2";
const tokenCache = new Map();
/** Map tax rate % to Fiskaly SIGN DE vat_rate enum. */
function mapVatRateToFiskalyDe(ratePercent) {
    const r = Math.round(Number(ratePercent) * 100) / 100;
    if (!Number.isFinite(r) || r <= 0.001)
        return "NULL";
    if (Math.abs(r - 7) < 0.51)
        return "REDUCED_1";
    if (Math.abs(r - 5.5) < 0.51)
        return "REDUCED_2";
    if (Math.abs(r - 19) < 0.51)
        return "NORMAL";
    if (r < 8)
        return "REDUCED_1";
    return "NORMAL";
}
/** Map POS payment method to Fiskaly payment_type. */
function mapPaymentMethodToFiskalyDe(method) {
    const m = String(method || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
    if (m === "cash")
        return "CASH";
    if (m === "card" || m === "terminal" || m === "tap_to_pay" || m === "softpos")
        return "CARD";
    return "NON_CASH";
}
function cacheKey(apiKey, environment) {
    return `${environment}:${apiKey}`;
}
function formatEuroAmount(amount) {
    return (0, money_1.roundMoney2)(amount).toFixed(2);
}
function itemTaxRatePercent(item) {
    if (item.taxRate != null && Number.isFinite(Number(item.taxRate))) {
        return Number(item.taxRate);
    }
    const total = Number(item.totalPrice) || 0;
    const tax = Number(item.taxAmount) || 0;
    const net = total - tax;
    if (net > 0.001 && tax >= 0) {
        return Math.round((tax / net) * 10000) / 100;
    }
    return 19;
}
function buildAmountsPerVatRate(sale) {
    const buckets = new Map();
    const items = Array.isArray(sale.items) ? sale.items : [];
    if (items.length) {
        for (const item of items) {
            const gross = Number(item.totalPrice) || 0;
            if (gross <= 0)
                continue;
            const vatRate = mapVatRateToFiskalyDe(itemTaxRatePercent(item));
            buckets.set(vatRate, (buckets.get(vatRate) || 0) + gross);
        }
    }
    else {
        const total = Number(sale.total) || 0;
        const tax = Number(sale.taxAmount) || 0;
        const subtotal = Number(sale.subtotal) || total - tax;
        const rate = subtotal > 0 ? (tax / subtotal) * 100 : 19;
        buckets.set(mapVatRateToFiskalyDe(rate), total);
    }
    if (!buckets.size) {
        buckets.set("NORMAL", Number(sale.total) || 0);
    }
    return [...buckets.entries()].map(([vat_rate, amount]) => ({
        vat_rate,
        amount: formatEuroAmount(amount),
    }));
}
function buildAmountsPerPaymentType(sale) {
    const breakdown = sale.paymentBreakdown?.filter((p) => Number(p.amount) > 0) || [];
    if (breakdown.length) {
        const buckets = new Map();
        for (const p of breakdown) {
            const kind = mapPaymentMethodToFiskalyDe(p.method);
            buckets.set(kind, (buckets.get(kind) || 0) + Number(p.amount));
        }
        return [...buckets.entries()].map(([payment_type, amount]) => ({
            payment_type,
            amount: formatEuroAmount(amount),
        }));
    }
    return [
        {
            payment_type: mapPaymentMethodToFiskalyDe(sale.paymentMethod || "cash"),
            amount: formatEuroAmount(Number(sale.total) || 0),
        },
    ];
}
class FiskalyDeService {
    static async authenticate(apiKey, apiSecret, environment = "test") {
        const key = cacheKey(apiKey, environment);
        const cached = tokenCache.get(key);
        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }
        const { data } = await axios_1.default.post(`${DE_BASE_URL}/auth`, { api_key: apiKey, api_secret: apiSecret }, { timeout: 20000, validateStatus: () => true });
        if (data?.status_code && data.status_code >= 400) {
            throw new Error(data?.message || data?.code || "Fiskaly DE authentication failed");
        }
        const token = String(data?.access_token || "").trim();
        if (!token)
            throw new Error("Fiskaly DE authentication returned no access_token");
        const expiresAtSec = Number(data?.access_token_expires_at);
        const expiresAt = Number.isFinite(expiresAtSec)
            ? expiresAtSec * 1000
            : Date.now() + 23 * 60 * 60 * 1000;
        tokenCache.set(key, { token, expiresAt });
        return token;
    }
    static async testConnection(de, environment) {
        if (!de.apiKey || !de.apiSecret)
            throw new Error("API key and secret are required");
        const token = await this.authenticate(de.apiKey, de.apiSecret, environment);
        if (de.tssId) {
            const { data } = await axios_1.default.get(`${DE_BASE_URL}/tss/${de.tssId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 20000,
                validateStatus: () => true,
            });
            if (data?.status_code && data.status_code >= 400) {
                throw new Error(data?.message || data?.code || "TSS not reachable");
            }
        }
    }
    static async signTransaction(opts) {
        const { de, environment, sale } = opts;
        if (!de.apiKey || !de.apiSecret)
            throw new Error("Fiskaly DE credentials missing");
        if (!de.tssId)
            throw new Error("Fiskaly DE TSS ID is required");
        if (!de.clientId)
            throw new Error("Fiskaly DE client ID is required");
        const token = await this.authenticate(de.apiKey, de.apiSecret, environment);
        const txId = (0, crypto_1.randomUUID)();
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        const activeRes = await axios_1.default.put(`${DE_BASE_URL}/tss/${de.tssId}/tx/${txId}?tx_revision=1`, { state: "ACTIVE", client_id: de.clientId }, { headers, timeout: 30000, validateStatus: () => true });
        if (activeRes.data?.status_code && activeRes.data.status_code >= 400) {
            throw new Error(activeRes.data?.message || activeRes.data?.code || "Fiskaly DE ACTIVE failed");
        }
        const finishBody = {
            state: "FINISHED",
            client_id: de.clientId,
            schema: {
                standard_v1: {
                    receipt: {
                        receipt_type: "RECEIPT",
                        amounts_per_vat_rate: buildAmountsPerVatRate(sale),
                        amounts_per_payment_type: buildAmountsPerPaymentType(sale),
                    },
                },
            },
        };
        const finishRes = await axios_1.default.put(`${DE_BASE_URL}/tss/${de.tssId}/tx/${txId}?tx_revision=2`, finishBody, { headers, timeout: 30000, validateStatus: () => true });
        const body = finishRes.data;
        if (body?.status_code && body.status_code >= 400) {
            throw new Error(body?.message || body?.code || "Fiskaly DE FINISHED failed");
        }
        const signature = body?.signature?.value != null ? String(body.signature.value) : null;
        const qrCodeData = body?.qr_code_data != null ? String(body.qr_code_data) : null;
        const txNumber = body?.number ?? null;
        const tssSerial = body?.tss_serial_number != null ? String(body.tss_serial_number) : null;
        return {
            signature,
            qrCodeData,
            txNumber,
            txId,
            tssSerial,
            raw: body,
        };
    }
}
exports.FiskalyDeService = FiskalyDeService;
//# sourceMappingURL=fiskaly-de.service.js.map