"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuestCrmService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const pos_reports_service_1 = require("@/services/pos-reports.service");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
function normalizeTags(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const t of raw) {
        const s = String(t || "")
            .trim()
            .slice(0, 40);
        if (!s || out.includes(s))
            continue;
        out.push(s);
        if (out.length >= 20)
            break;
    }
    return out;
}
function displayName(c) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
    if (name)
        return name;
    if (c.email)
        return c.email;
    if (c.phone)
        return c.phone;
    return "Guest";
}
class GuestCrmService {
    static async listProfiles(merchantId, opts) {
        await (0, ensure_merchant_schema_1.ensureCustomerCrmTagsColumn)();
        const db = (0, db_1.getDb)();
        const page = Math.max(1, Number(opts.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
        const offset = (page - 1) * limit;
        const conditions = [(0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)];
        const search = String(opts.search || "").trim();
        if (search) {
            const q = `%${search}%`;
            const digits = search.replace(/\D/g, "");
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(db_1.schema.customers.email, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.phone, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.firstName, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.lastName, q), (0, drizzle_orm_1.sql) `(${db_1.schema.customers.firstName} || ' ' || coalesce(${db_1.schema.customers.lastName}, '')) ilike ${q}`, digits.length >= 3
                ? (0, drizzle_orm_1.sql) `regexp_replace(coalesce(${db_1.schema.customers.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
                : (0, drizzle_orm_1.sql) `false`));
        }
        const rows = await db.query.customers.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            limit,
            offset,
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.customers.lastOrderAt), (0, drizzle_orm_1.desc)(db_1.schema.customers.updatedAt)],
        });
        const ids = rows.map((r) => r.id);
        const statsByCustomer = new Map();
        if (ids.length) {
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.customerId, ids)),
                columns: {
                    customerId: true,
                    status: true,
                    paymentStatus: true,
                    total: true,
                    createdAt: true,
                },
            });
            for (const o of orders) {
                if (!o.customerId || !(0, pos_reports_service_1.isCountableSale)(o))
                    continue;
                const cur = statsByCustomer.get(o.customerId) || {
                    orderCount: 0,
                    lastVisit: null,
                    lifetimeRevenue: 0,
                };
                cur.orderCount += 1;
                cur.lifetimeRevenue += Number(o.total) || 0;
                const at = o.createdAt ? new Date(o.createdAt) : null;
                if (at && (!cur.lastVisit || at > cur.lastVisit))
                    cur.lastVisit = at;
                statsByCustomer.set(o.customerId, cur);
            }
        }
        return {
            page,
            limit,
            profiles: rows.map((c) => {
                const stats = statsByCustomer.get(c.id);
                const crmTags = normalizeTags(c.crmTags);
                return {
                    id: c.id,
                    name: displayName(c),
                    firstName: c.firstName,
                    lastName: c.lastName,
                    email: c.email,
                    phone: c.phone,
                    loyaltyPoints: c.loyaltyPoints ?? 0,
                    totalSpent: Number(c.totalSpent) || 0,
                    marketingOptIn: c.marketingOptIn !== false,
                    lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : null,
                    tags: crmTags,
                    orderCount: stats?.orderCount ?? 0,
                    lastVisit: stats?.lastVisit?.toISOString() ?? (c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : null),
                    lifetimeRevenue: stats?.lifetimeRevenue ?? (Number(c.totalSpent) || 0),
                    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
                };
            }),
        };
    }
    static async getProfile(merchantId, customerId) {
        await (0, ensure_merchant_schema_1.ensureCustomerCrmTagsColumn)();
        const db = (0, db_1.getDb)();
        const customer = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
        });
        if (!customer)
            throw new Error("Customer not found");
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.customerId, customerId)),
            orderBy: (0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt),
            limit: 20,
            columns: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                total: true,
                orderType: true,
                createdAt: true,
            },
        });
        const visits = orders.filter((o) => (0, pos_reports_service_1.isCountableSale)(o));
        return {
            profile: {
                id: customer.id,
                name: displayName(customer),
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                loyaltyPoints: customer.loyaltyPoints ?? 0,
                totalSpent: Number(customer.totalSpent) || 0,
                marketingOptIn: customer.marketingOptIn !== false,
                tags: normalizeTags(customer.crmTags),
                orderCount: visits.length,
                lastVisit: visits[0]?.createdAt ? new Date(visits[0].createdAt).toISOString() : null,
            },
            recentOrders: visits.slice(0, 15).map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                orderType: o.orderType,
                total: Number(o.total) || 0,
                createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
            })),
        };
    }
    static async updateTags(merchantId, customerId, tags) {
        await (0, ensure_merchant_schema_1.ensureCustomerCrmTagsColumn)();
        const db = (0, db_1.getDb)();
        const normalized = normalizeTags(tags);
        const existing = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Customer not found");
        await db.execute((0, drizzle_orm_1.sql) `UPDATE customers SET crm_tags = ${JSON.stringify(normalized)}::jsonb, updated_at = NOW() WHERE id = ${customerId} AND merchant_id = ${merchantId}`);
        return { tags: normalized };
    }
}
exports.GuestCrmService = GuestCrmService;
//# sourceMappingURL=guest-crm.service.js.map