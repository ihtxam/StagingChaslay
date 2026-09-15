"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDomainService = void 0;
const node_https_1 = __importDefault(require("node:https"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const brand_1 = require("@/lib/brand");
const custom_domain_dns_1 = require("@/lib/custom-domain-dns");
const domain_1 = require("@/lib/domain");
function normalizeDnsStatus(raw) {
    const v = String(raw || "none").toLowerCase();
    if (v === "pending" || v === "verified" || v === "failed")
        return v;
    return "none";
}
function normalizeSslStatus(raw) {
    const v = String(raw || "none").toLowerCase();
    if (v === "pending" || v === "active" || v === "failed")
        return v;
    return "none";
}
function dnsHintHost(domain) {
    const parts = domain.split(".").filter(Boolean);
    if (parts.length <= 2)
        return "www";
    return parts[0] || "www";
}
function deriveStep(pending, active, dns, ssl) {
    if (active && !pending) {
        if (dns === "verified" && ssl === "active")
            return "active";
        // Legacy merchants saved customDomain before wizard status columns existed.
        if (dns === "none" && (ssl === "none" || ssl === "active"))
            return "active";
        if (dns === "verified" && ssl === "pending")
            return "ssl";
    }
    if (pending && dns !== "verified")
        return "verify_dns";
    if (pending || active)
        return "verify_dns";
    return "enter";
}
function mapMerchantToStatus(merchant) {
    const shopHost = (0, brand_1.resolveShopPublicHost)();
    const pending = merchant.customDomainPending || null;
    const active = merchant.customDomain || null;
    const dnsStatus = normalizeDnsStatus(merchant.customDomainDnsStatus);
    const sslStatus = normalizeSslStatus(merchant.customDomainSslStatus);
    const domain = active || pending;
    const verifiedAt = merchant.customDomainVerifiedAt
        ? new Date(merchant.customDomainVerifiedAt).toISOString()
        : null;
    return {
        enabled: true,
        shopHost,
        domain,
        pendingDomain: pending,
        activeDomain: active,
        dnsStatus,
        sslStatus,
        verifiedAt,
        shopUrl: active ? `https://${active}` : null,
        step: deriveStep(pending, active, dnsStatus, sslStatus),
        dnsHintHost: domain ? dnsHintHost(domain) : "www",
    };
}
async function assertDomainAvailable(domain, merchantId) {
    const db = (0, db_1.getDb)();
    const taken = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.customDomain, domain),
        columns: { id: true },
    });
    if (taken && taken.id !== merchantId) {
        throw new Error("Custom domain already in use");
    }
    const pendingTaken = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.customDomainPending, domain),
        columns: { id: true },
    });
    if (pendingTaken && pendingTaken.id !== merchantId) {
        throw new Error("Custom domain already in use");
    }
}
function scheduleSslProbe(merchantId, hostname) {
    setImmediate(() => {
        void CustomDomainService.probeSslInBackground(merchantId, hostname);
    });
}
class CustomDomainService {
    static isWizardEnabled() {
        return process.env.CUSTOM_DOMAIN_WIZARD_ENABLED !== "0";
    }
    static async getStatus(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                customDomain: true,
                customDomainPending: true,
                customDomainDnsStatus: true,
                customDomainSslStatus: true,
                customDomainVerifiedAt: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const status = mapMerchantToStatus(merchant);
        status.enabled = this.isWizardEnabled();
        if (status.activeDomain &&
            status.dnsStatus === "verified" &&
            status.sslStatus === "pending") {
            scheduleSslProbe(merchantId, status.activeDomain);
        }
        return status;
    }
    static async startSetup(merchantId, rawDomain) {
        const domain = (0, domain_1.normalizeCustomDomainHost)(rawDomain);
        if (!domain || !(0, domain_1.isValidCustomDomainHost)(domain)) {
            throw new Error("Enter a valid domain (e.g. www.mycafe.ch)");
        }
        await assertDomainAvailable(domain, merchantId);
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomainPending: domain,
            customDomainDnsStatus: "pending",
            customDomainSslStatus: "none",
            customDomainVerifiedAt: null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return this.getStatus(merchantId);
    }
    static async verifyDns(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                customDomainPending: true,
                customDomain: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const hostname = merchant.customDomainPending || merchant.customDomain;
        if (!hostname) {
            throw new Error("Add a domain before verifying DNS");
        }
        const result = await (0, custom_domain_dns_1.verifyCustomDomainDns)(hostname);
        if (!result.ok) {
            await db
                .update(db_1.schema.merchants)
                .set({
                customDomainDnsStatus: "failed",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            throw new Error(`DNS not ready yet. Point a CNAME for ${hostname} to ${(0, brand_1.resolveShopPublicHost)()} and try again.`);
        }
        await assertDomainAvailable(hostname, merchantId);
        const now = new Date();
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomain: hostname,
            customDomainPending: null,
            customDomainDnsStatus: "verified",
            customDomainSslStatus: "pending",
            customDomainVerifiedAt: now,
            updatedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        scheduleSslProbe(merchantId, hostname);
        return this.getStatus(merchantId);
    }
    static async refreshSsl(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { customDomain: true, customDomainDnsStatus: true },
        });
        if (!merchant?.customDomain || merchant.customDomainDnsStatus !== "verified") {
            throw new Error("Verify DNS before checking SSL");
        }
        const ok = await this.probeSsl(merchant.customDomain);
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomainSslStatus: ok ? "active" : "pending",
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return this.getStatus(merchantId);
    }
    static async removeDomain(merchantId) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomain: null,
            customDomainPending: null,
            customDomainDnsStatus: "none",
            customDomainSslStatus: "none",
            customDomainVerifiedAt: null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return this.getStatus(merchantId);
    }
    /** Legacy settings save: mark DNS/SSL as active when domain is set directly. */
    static async markLegacyDomainActive(merchantId, domain) {
        const db = (0, db_1.getDb)();
        if (!domain) {
            await db
                .update(db_1.schema.merchants)
                .set({
                customDomain: null,
                customDomainPending: null,
                customDomainDnsStatus: "none",
                customDomainSslStatus: "none",
                customDomainVerifiedAt: null,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return;
        }
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomain: domain,
            customDomainPending: null,
            customDomainDnsStatus: "verified",
            customDomainSslStatus: "active",
            customDomainVerifiedAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    }
    static probeSsl(hostname) {
        return new Promise((resolve) => {
            const req = node_https_1.default.request({
                host: hostname,
                port: 443,
                method: "HEAD",
                path: "/",
                timeout: 8000,
                rejectUnauthorized: true,
            }, (res) => {
                res.resume();
                resolve((res.statusCode || 0) < 500);
            });
            req.on("timeout", () => {
                req.destroy();
                resolve(false);
            });
            req.on("error", () => resolve(false));
            req.end();
        });
    }
    static async probeSslInBackground(merchantId, hostname) {
        const ok = await this.probeSsl(hostname);
        if (!ok)
            return;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({
            customDomainSslStatus: "active",
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    }
}
exports.CustomDomainService = CustomDomainService;
//# sourceMappingURL=custom-domain.service.js.map