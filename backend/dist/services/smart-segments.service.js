"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSegmentsService = void 0;
exports.normalizeSmartSegments = normalizeSmartSegments;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const smart_segments_addon_1 = require("@/lib/smart-segments-addon");
const pos_reports_service_1 = require("@/services/pos-reports.service");
function normalizeTag(raw) {
    return String(raw || "")
        .trim()
        .slice(0, 40);
}
function normalizeSmartSegments(raw) {
    const rulesIn = Array.isArray(raw?.rules) ? raw.rules : [];
    const rules = rulesIn
        .map((r) => {
        const type = r?.type;
        if (type !== "min_lifetime_spend" && type !== "min_orders" && type !== "lapsed_days")
            return null;
        const threshold = Math.max(0, Number(r.threshold) || 0);
        const tag = normalizeTag(r.tag || "");
        if (!tag)
            return null;
        return {
            id: String(r.id || (0, crypto_1.randomUUID)()).slice(0, 64),
            tag,
            type,
            threshold,
            enabled: r.enabled !== false,
        };
    })
        .filter(Boolean);
    return {
        rules,
        lastAppliedAt: raw?.lastAppliedAt ? String(raw.lastAppliedAt) : null,
    };
}
function mergeTags(existing, add) {
    const base = Array.isArray(existing)
        ? existing.map((t) => normalizeTag(String(t))).filter(Boolean)
        : [];
    for (const t of add) {
        if (!base.includes(t))
            base.push(t);
        if (base.length >= 20)
            break;
    }
    return base;
}
class SmartSegmentsService {
    static async getSettings(merchantId) {
        await (0, ensure_merchant_schema_1.ensureSmartSegmentsAddonColumn)();
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { smartSegmentsSettings: true },
        });
        return normalizeSmartSegments(merchant?.smartSegmentsSettings);
    }
    static async updateSettings(merchantId, raw) {
        await (0, ensure_merchant_schema_1.ensureSmartSegmentsAddonColumn)();
        const prev = await this.getSettings(merchantId);
        const next = normalizeSmartSegments({ ...raw, lastAppliedAt: prev.lastAppliedAt });
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ smartSegmentsSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return next;
    }
    static async apply(merchantId) {
        if (!(await (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(merchantId))) {
            throw new Error("Smart segments requires the Smart Segments add-on");
        }
        await (0, ensure_merchant_schema_1.ensureCustomerCrmTagsColumn)();
        const settings = await this.getSettings(merchantId);
        const active = settings.rules.filter((r) => r.enabled);
        if (!active.length) {
            return { updated: 0, matched: 0, lastAppliedAt: settings.lastAppliedAt || null };
        }
        const db = (0, db_1.getDb)();
        const customers = await db.query.customers.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId),
            columns: {
                id: true,
                crmTags: true,
                totalSpent: true,
                lastOrderAt: true,
            },
        });
        const ids = customers.map((c) => c.id);
        const orderCounts = new Map();
        if (ids.length) {
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.customerId, ids)),
                columns: { customerId: true, status: true, paymentStatus: true },
            });
            for (const o of orders) {
                if (!o.customerId || !(0, pos_reports_service_1.isCountableSale)(o))
                    continue;
                orderCounts.set(o.customerId, (orderCounts.get(o.customerId) || 0) + 1);
            }
        }
        const now = Date.now();
        let updated = 0;
        for (const c of customers) {
            const tagsToAdd = [];
            const spend = Number(c.totalSpent) || 0;
            const orders = orderCounts.get(c.id) || 0;
            const last = c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0;
            const daysSince = last ? (now - last) / 86400000 : 9999;
            for (const rule of active) {
                if (rule.type === "min_lifetime_spend" && spend >= rule.threshold)
                    tagsToAdd.push(rule.tag);
                if (rule.type === "min_orders" && orders >= rule.threshold)
                    tagsToAdd.push(rule.tag);
                if (rule.type === "lapsed_days" && daysSince >= rule.threshold && orders > 0) {
                    tagsToAdd.push(rule.tag);
                }
            }
            if (!tagsToAdd.length)
                continue;
            const merged = mergeTags(c.crmTags, tagsToAdd);
            await db
                .update(db_1.schema.customers)
                .set({ crmTags: merged, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, c.id));
            updated += 1;
        }
        const lastAppliedAt = new Date().toISOString();
        await db
            .update(db_1.schema.merchants)
            .set({
            smartSegmentsSettings: { ...settings, lastAppliedAt },
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return { updated, matched: customers.length, lastAppliedAt };
    }
    /** Preview counts per rule without writing tags. */
    static async preview(merchantId) {
        if (!(await (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(merchantId))) {
            throw new Error("Smart segments requires the Smart Segments add-on");
        }
        const settings = await this.getSettings(merchantId);
        const db = (0, db_1.getDb)();
        const rows = await db
            .select({
            id: db_1.schema.customers.id,
            totalSpent: db_1.schema.customers.totalSpent,
            lastOrderAt: db_1.schema.customers.lastOrderAt,
        })
            .from(db_1.schema.customers)
            .where((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId));
        const previews = [];
        for (const rule of settings.rules.filter((r) => r.enabled)) {
            let count = 0;
            if (rule.type === "min_lifetime_spend") {
                count = rows.filter((r) => Number(r.totalSpent) >= rule.threshold).length;
            }
            else if (rule.type === "lapsed_days") {
                const cutoff = new Date(Date.now() - rule.threshold * 86400000);
                count = rows.filter((r) => r.lastOrderAt && new Date(r.lastOrderAt) <= cutoff).length;
            }
            else if (rule.type === "min_orders") {
                const sub = await db.execute((0, drizzle_orm_1.sql) `
          SELECT customer_id, COUNT(*)::int AS c FROM orders
          WHERE merchant_id = ${merchantId} AND customer_id IS NOT NULL
          GROUP BY customer_id HAVING COUNT(*) >= ${rule.threshold}
        `);
                const list = Array.isArray(sub) ? sub : sub.rows || [];
                count = list.length;
            }
            previews.push({ ruleId: rule.id, tag: rule.tag, type: rule.type, threshold: rule.threshold, count });
        }
        return { rules: settings.rules, previews, lastAppliedAt: settings.lastAppliedAt || null };
    }
}
exports.SmartSegmentsService = SmartSegmentsService;
//# sourceMappingURL=smart-segments.service.js.map