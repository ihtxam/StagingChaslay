"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationCampaignsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const reservation_campaigns_addon_1 = require("@/lib/reservation-campaigns-addon");
function normalizeCode(raw) {
    return String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}
class ReservationCampaignsService {
    static async list(merchantId) {
        await (0, ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn)();
        const db = (0, db_1.getDb)();
        const rows = await db.query.reservationGrowthCampaigns.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.reservationGrowthCampaigns.createdAt)],
        });
        return rows.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            perkLabel: r.perkLabel,
            message: r.message,
            clickCount: r.clickCount,
            bookingCount: r.bookingCount,
            active: r.active,
            createdAt: r.createdAt,
        }));
    }
    static async save(merchantId, input) {
        if (!(await (0, reservation_campaigns_addon_1.merchantHasReservationCampaignsLicense)(merchantId))) {
            throw new Error("Reservation campaigns requires the Reservation Campaigns add-on");
        }
        await (0, ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn)();
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim().slice(0, 200);
        if (!name)
            throw new Error("Campaign name is required");
        const code = normalizeCode(input.code || name) || `camp-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        const patch = {
            name,
            code,
            perkLabel: input.perkLabel?.trim().slice(0, 200) || null,
            message: input.message?.trim().slice(0, 2000) || null,
            active: input.active !== false,
            updatedAt: new Date(),
        };
        if (input.id) {
            const [row] = await db
                .update(db_1.schema.reservationGrowthCampaigns)
                .set(patch)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.id, input.id), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.merchantId, merchantId)))
                .returning();
            if (!row)
                throw new Error("Campaign not found");
            return row;
        }
        const [row] = await db
            .insert(db_1.schema.reservationGrowthCampaigns)
            .values({ merchantId, ...patch })
            .returning();
        return row;
    }
    static async trackClick(merchantId, code) {
        await (0, ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn)();
        const db = (0, db_1.getDb)();
        const normalized = normalizeCode(code);
        const [row] = await db
            .update(db_1.schema.reservationGrowthCampaigns)
            .set({
            clickCount: (0, drizzle_orm_1.sql) `${db_1.schema.reservationGrowthCampaigns.clickCount} + 1`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.code, normalized), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.active, true)))
            .returning();
        return row || null;
    }
    static async trackBooking(merchantId, code) {
        await (0, ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn)();
        const db = (0, db_1.getDb)();
        const normalized = normalizeCode(code);
        const [row] = await db
            .update(db_1.schema.reservationGrowthCampaigns)
            .set({
            bookingCount: (0, drizzle_orm_1.sql) `${db_1.schema.reservationGrowthCampaigns.bookingCount} + 1`,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.code, normalized), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.active, true)))
            .returning();
        return row || null;
    }
    static async publicInfo(merchantId, code) {
        await (0, ensure_merchant_schema_1.ensureReservationCampaignsAddonColumn)();
        const db = (0, db_1.getDb)();
        const normalized = normalizeCode(code);
        const row = await db.query.reservationGrowthCampaigns.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.code, normalized), (0, drizzle_orm_1.eq)(db_1.schema.reservationGrowthCampaigns.active, true)),
        });
        if (!row)
            return null;
        return {
            code: row.code,
            name: row.name,
            perkLabel: row.perkLabel,
            message: row.message,
        };
    }
}
exports.ReservationCampaignsService = ReservationCampaignsService;
//# sourceMappingURL=reservation-campaigns.service.js.map