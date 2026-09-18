"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantEntitlementsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
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
        try {
            return await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => this.loadLimits(merchantId));
        }
        catch (error) {
            console.warn("[entitlements] getLimits failed, using merchant-row defaults:", error);
            return this.loadLimitsFromMerchantOnly(merchantId);
        }
    }
    static async loadLimitsFromMerchantOnly(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                subscriptionPlan: true,
                maxPosPosts: true,
                maxWaiterPosts: true,
                maxStaff: true,
                maxLocations: true,
                signageScreenLimit: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        return {
            maxPosPosts: Math.max(0, Number(merchant.maxPosPosts) || 0),
            maxWaiterPosts: Math.max(0, Number(merchant.maxWaiterPosts) || 0),
            maxStaff: Math.max(0, Number(merchant.maxStaff) || 0),
            maxLocations: Math.max(0, Number(merchant.maxLocations) || 1) || 1,
            maxProducts: null,
            signageScreenLimit: (0, signage_addon_1.normalizeSignageScreenLimit)(merchant.signageScreenLimit),
            planSlug: merchant.subscriptionPlan || "free",
            planName: null,
        };
    }
    static async loadLimits(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                subscriptionPlan: true,
                maxPosPosts: true,
                maxWaiterPosts: true,
                maxStaff: true,
                maxLocations: true,
                signageScreenLimit: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const planSlug = merchant.subscriptionPlan || "free";
        let plan = null;
        try {
            plan = (await subscription_plans_service_1.SubscriptionPlansService.getBySlugForLimits(planSlug)) || null;
        }
        catch (error) {
            console.warn("[entitlements] plan lookup skipped:", error);
            plan = null;
        }
        const maxPosPosts = pickStationLimit(merchant.maxPosPosts, plan?.maxPosPosts ?? 0, plan?.maxDevices ?? 0);
        const maxWaiterPosts = pickStationLimit(merchant.maxWaiterPosts, plan?.maxWaiterPosts ?? 0, 0);
        const merchantStaff = Math.max(0, Number(merchant.maxStaff) || 0);
        const planStaff = Math.max(0, Number(plan?.maxStaff) || 0);
        const maxStaff = merchantStaff > 0 ? merchantStaff : planStaff > 0 ? planStaff : 0;
        const merchantLocations = Math.max(0, Number(merchant.maxLocations) || 0);
        const planLocations = Math.max(0, Number(plan?.maxLocations) || 0);
        const maxLocations = merchantLocations > 0 ? merchantLocations : planLocations > 0 ? planLocations : 1;
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
            maxLocations,
            maxProducts,
            signageScreenLimit: signage.screenLimit,
            planSlug: plan?.slug || planSlug,
            planName: plan?.name || null,
        };
    }
    static async countActiveLocations(merchantId) {
        const { LocationsService } = await Promise.resolve().then(() => __importStar(require("@/services/locations.service")));
        return LocationsService.countActive(merchantId);
    }
    static async getLocationLimitInfo(merchantId) {
        const limits = await this.getLimits(merchantId);
        const currentCount = await this.countActiveLocations(merchantId);
        return {
            maxLocations: limits.maxLocations,
            currentCount,
            planSlug: limits.planSlug,
            planName: limits.planName,
        };
    }
    static async assertCanAddLocation(merchantId, addCount = 1) {
        const info = await this.getLocationLimitInfo(merchantId);
        if (info.maxLocations <= 0)
            return info;
        const next = info.currentCount + Math.max(1, addCount);
        if (next > info.maxLocations) {
            const err = new Error(`Location limit reached (${info.maxLocations} on ${info.planName || info.planSlug || "your plan"}). Upgrade or add an extra location add-on.`);
            err.statusCode = 403;
            err.code = "LOCATION_LIMIT_REACHED";
            err.limit = info;
            throw err;
        }
        return info;
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