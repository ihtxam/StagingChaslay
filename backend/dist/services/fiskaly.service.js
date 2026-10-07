"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiskalyService = exports.normalizeCountry = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const fiskaly_settings_1 = require("@/lib/fiskaly-settings");
const fiskaly_de_service_1 = require("@/services/fiskaly-de.service");
const fiskaly_fr_service_1 = require("@/services/fiskaly-fr.service");
var fiskaly_settings_2 = require("@/lib/fiskaly-settings");
Object.defineProperty(exports, "normalizeCountry", { enumerable: true, get: function () { return fiskaly_settings_2.normalizeCountry; } });
async function loadMerchantFiskaly(merchantId) {
    const db = (0, db_1.getDb)();
    const merchant = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        columns: { country: true, fiskalySettings: true },
    });
    if (!merchant)
        throw new Error("Merchant not found");
    const country = (0, fiskaly_settings_1.normalizeCountry)(merchant.country);
    const settings = (0, fiskaly_settings_1.normalizeFiskalySettings)(merchant.fiskalySettings);
    return { country, settings };
}
class FiskalyService {
    static normalizeCountry(country) {
        return (0, fiskaly_settings_1.normalizeCountry)(country);
    }
    static async signPosSale(merchantId, orderId, sale) {
        const { country, settings } = await loadMerchantFiskaly(merchantId);
        if (!settings.enabled || !country)
            return null;
        let signature = null;
        if (country === "DE" && settings.de?.apiKey && settings.de?.apiSecret) {
            const result = await fiskaly_de_service_1.FiskalyDeService.signTransaction({
                de: settings.de,
                environment: settings.environment || "test",
                sale,
            });
            signature = {
                country: "DE",
                qrCodeData: result.qrCodeData,
                signature: result.signature,
                txNumber: result.txNumber,
                txId: result.txId,
                tssSerial: result.tssSerial,
                signedAt: new Date().toISOString(),
                raw: result.raw,
            };
        }
        else if (country === "FR" && settings.fr?.apiKey && settings.fr?.apiSecret) {
            const result = await fiskaly_fr_service_1.FiskalyFrService.signTransaction({
                fr: settings.fr,
                environment: settings.environment || "test",
                sale,
            });
            signature = {
                country: "FR",
                qrCodeData: result.qrCodeData,
                signature: result.signature,
                txNumber: result.txNumber,
                txId: result.txId,
                signedAt: new Date().toISOString(),
                raw: result.raw,
            };
        }
        else {
            throw new Error(country === "DE"
                ? "Fiskaly DE is enabled but credentials or TSS/client IDs are incomplete"
                : "Fiskaly FR is enabled but credentials are incomplete");
        }
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.orders)
            .set({ fiskalySignature: signature })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        return signature;
    }
    static async signPosRefund(merchantId, orderId, _refundPayload) {
        const { country, settings } = await loadMerchantFiskaly(merchantId);
        if (!settings.enabled || !country)
            return null;
        console.warn("[fiskaly] signPosRefund not implemented for MVP", { merchantId, orderId, country });
        return null;
    }
    static async testConnection(merchantId, country) {
        const { settings } = await loadMerchantFiskaly(merchantId);
        const env = settings.environment || "test";
        if (country === "DE") {
            await fiskaly_de_service_1.FiskalyDeService.testConnection(settings.de || {}, env);
            return;
        }
        if (country === "FR") {
            await fiskaly_fr_service_1.FiskalyFrService.testConnection(settings.fr || {}, env);
            return;
        }
        throw new Error("Unsupported country");
    }
    static async provisionDe(merchantId, opts) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { country: true, fiskalySettings: true, name: true },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        if ((0, fiskaly_settings_1.normalizeCountry)(merchant.country) !== "DE") {
            throw new Error("Fiskaly SIGN DE provisioning is only for Germany merchants");
        }
        const settings = (0, fiskaly_settings_1.normalizeFiskalySettings)(merchant.fiskalySettings);
        if (!settings.de?.apiKey || !settings.de?.apiSecret) {
            throw new Error("Save API key and secret before provisioning TSS");
        }
        const env = settings.environment || "test";
        const provisioned = await fiskaly_de_service_1.FiskalyDeService.provisionCloudTssAndClient(settings.de, env, {
            clientSerial: opts?.clientSerial,
            description: opts?.description || `${merchant.name || "Reborn POS"} TSS`,
        });
        const merged = (0, fiskaly_settings_1.mergeFiskalySettings)(settings, {
            enabled: true,
            de: {
                tssId: provisioned.tssId,
                clientId: provisioned.clientId,
                clientSerial: provisioned.clientSerial,
                adminPin: provisioned.adminPin,
            },
        });
        await db
            .update(db_1.schema.merchants)
            .set({ fiskalySettings: merged, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return (0, fiskaly_settings_1.getFiskalyPublic)(merged);
    }
    static toPushResponse(sig) {
        if (!sig)
            return undefined;
        return {
            qrCodeData: sig.qrCodeData,
            signature: sig.signature,
            txNumber: sig.txNumber,
            txId: sig.txId,
        };
    }
    /** Sign a completed POS sale pushed via /sync/push-sales when Fiskaly is enabled. */
    static async maybeSignSyncedPosSale(merchantId, orderId, sale) {
        const sig = await this.signPosSale(merchantId, orderId, sale);
        return this.toPushResponse(sig);
    }
}
exports.FiskalyService = FiskalyService;
//# sourceMappingURL=fiskaly.service.js.map