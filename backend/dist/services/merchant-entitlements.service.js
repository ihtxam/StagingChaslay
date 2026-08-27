"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantEntitlementsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const subscription_plans_service_1 = require("@/services/subscription-plans.service");
const signage_addon_1 = require("@/lib/signage-addon");
/** 0 = unlimited for station/staff limits. */
function pickStationLimit(merchantVal, planVal, planDevices) {
    const m = Math.max(0, Number(merchantVal) || 0);
    if (m > 0)
        return m;
    const p = Math.max(0, Number(planVal) || 0);
    if (p > 0)
        return p;
    const d = Math.max(0, Number(planDevices) || 0);
    return d > 0 ? d : 0;
}
class MerchantEntitlementsService {
    static async getLimits(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                subscriptionPlan: true,
                maxPosPosts: true,
                maxWaiterPosts: true,
                maxStaff: true,
                signageScreenLimit: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const planSlug = merchant.subscriptionPlan || "free";
        const plan = (await subscription_plans_service_1.SubscriptionPlansService.getBySlug(planSlug)) || null;
        const maxPosPosts = pickStationLimit(merchant.maxPosPosts, plan?.maxPosPosts ?? 0, plan?.maxDevices ?? 0);
        const maxWaiterPosts = pickStationLimit(merchant.maxWaiterPosts, plan?.maxWaiterPosts ?? 0, 0);
        const merchantStaff = Math.max(0, Number(merchant.maxStaff) || 0);
        const planStaff = Math.max(0, Number(plan?.maxStaff) || 0);
        const maxStaff = merchantStaff > 0 ? merchantStaff : planStaff > 0 ? planStaff : 0;
        const maxRaw = plan?.maxProducts;
        const maxProducts = maxRaw === null || maxRaw === undefined ? null : Math.max(0, Number(maxRaw) || 0);
        const signage = await (0, signage_addon_1.readSignageAddon)(merchantId).catch(() => ({
            enabled: false,
            screenLimit: (0, signage_addon_1.normalizeSignageScreenLimit)(merchant.signageScreenLimit),
        }));
        return {
            maxPosPosts,
            maxWaiterPosts,
            maxStaff,
            maxProducts,
            signageScreenLimit: signage.screenLimit,
            planSlug: plan?.slug || planSlug,
            planName: plan?.name || null,
        };
    }
    static async countActiveStaff(merchantId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)));
        return Number(row?.total) || 0;
    }
    static async getStaffLimitInfo(merchantId) {
        const limits = await this.getLimits(merchantId);
        const currentCount = await this.countActiveStaff(merchantId);
        return {
            maxStaff: limits.maxStaff,
            currentCount,
            planSlug: limits.planSlug,
            planName: limits.planName,
        };
    }
    static async assertCanAddStaff(merchantId, addCount = 1) {
        const info = await this.getStaffLimitInfo(merchantId);
        if (info.maxStaff <= 0)
            return info;
        const next = info.currentCount + Math.max(1, addCount);
        if (next > info.maxStaff) {
            const err = new Error(`Staff limit reached (${info.maxStaff} on ${info.planName || info.planSlug || "your plan"}). Upgrade your subscription or add a staff add-on.`);
            err.statusCode = 403;
            err.code = "STAFF_LIMIT_REACHED";
            err.limit = info;
            throw err;
        }
        return info;
    }
    static async countActiveDeviceLicenses(merchantId) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const [row] = await db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.licenses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active"), (0, drizzle_orm_1.gt)(db_1.schema.licenses.expiresAt, now)));
        return Number(row?.total) || 0;
    }
    static async getDeviceLicenseLimitInfo(merchantId) {
        const limits = await this.getLimits(merchantId);
        const currentCount = await this.countActiveDeviceLicenses(merchantId);
        return {
            maxDevices: limits.maxPosPosts,
            currentCount,
            planSlug: limits.planSlug,
            planName: limits.planName,
        };
    }
    static async assertCanIssueDeviceLicense(merchantId, addCount = 1, opts) {
        const info = await this.getDeviceLicenseLimitInfo(merchantId);
        if (info.maxDevices <= 0)
            return info;
        if (opts?.skipIfDeviceAlreadyLicensed && opts.deviceId) {
            const db = (0, db_1.getDb)();
            const existing = await db.query.licenses.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.deviceId, opts.deviceId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active"), (0, drizzle_orm_1.gt)(db_1.schema.licenses.expiresAt, new Date())),
            });
            if (existing)
                return info;
        }
        const next = info.currentCount + Math.max(1, addCount);
        if (next > info.maxDevices) {
            const err = new Error(`Device license limit reached (${info.maxDevices} POS station(s) on ${info.planName || info.planSlug || "your plan"}). Upgrade your package or add an extra POS station add-on.`);
            err.statusCode = 403;
            err.code = "DEVICE_LIMIT_REACHED";
            err.limit = info;
            throw err;
        }
        return info;
    }
}
exports.MerchantEntitlementsService = MerchantEntitlementsService;
//# sourceMappingURL=merchant-entitlements.service.js.map