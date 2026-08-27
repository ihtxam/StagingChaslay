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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantService = void 0;
exports.normalizePosPostLimit = normalizePosPostLimit;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const auth_service_1 = require("./auth.service");
const chaslay_compat_service_1 = require("./chaslay-compat.service");
const ensure_licenses_schema_1 = require("@/lib/ensure-licenses-schema");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const business_module_1 = require("@/lib/business-module");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
const kds_addon_1 = require("@/lib/kds-addon");
const ods_addon_1 = require("@/lib/ods-addon");
function pickLastAppVersion(rows) {
    let best = null;
    for (const row of rows) {
        const version = String(row.appVersion || "").trim();
        if (!version)
            continue;
        const seenAt = row.seenAt ? new Date(row.seenAt).getTime() : 0;
        if (!Number.isFinite(seenAt))
            continue;
        if (!best || seenAt >= best.seenAt) {
            best = { version, seenAt };
        }
    }
    return {
        lastAppVersion: best?.version ?? null,
        lastAppVersionSeenAt: best && best.seenAt ? new Date(best.seenAt) : null,
    };
}
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
function cryptoRandomSecret() {
    return crypto_1.default.randomBytes(48).toString("hex");
}
function normalizePosPostLimit(value) {
    return Math.max(0, Math.min(99, Number(value) || 0));
}
class MerchantService {
    /**
     * Get all merchants with pagination + device/license counts
     */
    static async getAllMerchants(page = 1, limit = 20, search) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            const where = search
                ? (0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.merchants.name, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.merchants.email, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.merchants.slug, `%${search}%`))
                : undefined;
            const merchants = await (0, ensure_licenses_schema_1.withLicenseSchemaRetry)(() => db.query.merchants.findMany({
                where,
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.merchants.createdAt),
                with: {
                    devices: true,
                    licenses: true,
                    edition: true,
                },
            }));
            const merchantIds = merchants.map((m) => m.id);
            const floorDevices = merchantIds.length > 0
                ? await db.query.chaslayFloorDevices.findMany({
                    where: (0, drizzle_orm_1.inArray)(db_1.schema.chaslayFloorDevices.merchantId, merchantIds),
                })
                : [];
            const floorByMerchant = new Map();
            for (const row of floorDevices) {
                const list = floorByMerchant.get(row.merchantId) ?? [];
                list.push(row);
                floorByMerchant.set(row.merchantId, list);
            }
            const addonById = await (0, inventory_addon_1.readInventoryAddonEnabledMap)(merchantIds).catch(() => new Map());
            const signageById = await (0, signage_addon_1.readSignageAddonMap)(merchantIds).catch(() => new Map());
            const kdsById = await (0, kds_addon_1.readKdsAddonEnabledMap)(merchantIds).catch(() => new Map());
            const odsById = await (0, ods_addon_1.readOdsAddonEnabledMap)(merchantIds).catch(() => new Map());
            return merchants.map((m) => {
                const floor = floorByMerchant.get(m.id) ?? [];
                const lastSeen = pickLastAppVersion([
                    ...(m.devices ?? []).map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSync })),
                    ...floor.map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSeenAt })),
                ]);
                const inventoryOn = addonById.get(m.id) ?? (0, inventory_addon_1.isInventoryAddonEnabled)(m.inventoryAddonEnabled);
                const signage = signageById.get(m.id);
                const signageOn = signage?.enabled ?? (0, signage_addon_1.isSignageAddonEnabled)(m.signageAddonEnabled);
                const kdsOn = kdsById.get(m.id) ?? (0, kds_addon_1.isKdsAddonEnabled)(m.kdsAddonEnabled);
                const odsOn = odsById.get(m.id) ?? (0, ods_addon_1.isOdsAddonEnabled)(m.odsAddonEnabled);
                return {
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    phone: m.phone,
                    address: m.address,
                    city: m.city,
                    country: m.country,
                    slug: m.slug,
                    shopEnabled: m.shopEnabled,
                    status: m.status,
                    subscriptionPlan: m.subscriptionPlan,
                    trialEndsAt: m.trialEndsAt,
                    subscriptionEndsAt: m.subscriptionEndsAt,
                    editionId: m.editionId ?? null,
                    editionName: m.edition?.name ?? null,
                    planBillingPaid: m.planBillingPaid !== false,
                    lastAppVersion: lastSeen.lastAppVersion,
                    lastAppVersionSeenAt: lastSeen.lastAppVersionSeenAt,
                    resellerId: m.resellerId ?? null,
                    inventoryAddonEnabled: inventoryOn,
                    inventoryEnabled: inventoryOn,
                    signageAddonEnabled: signageOn,
                    signageEnabled: signageOn,
                    signageScreenLimit: signage?.screenLimit ?? (0, signage_addon_1.normalizeSignageScreenLimit)(m.signageScreenLimit),
                    kdsAddonEnabled: kdsOn,
                    kdsEnabled: kdsOn,
                    odsAddonEnabled: odsOn,
                    odsEnabled: odsOn,
                    createdAt: m.createdAt,
                    devices: m.devices?.length ?? 0,
                    licenses: m.licenses?.length ?? 0,
                    activeLicenses: m.licenses?.filter((l) => l.status === "active").length ?? 0,
                };
            });
        }
        catch (error) {
            console.error("Error getting merchants:", error);
            throw error;
        }
    }
    /**
     * Get merchant by ID
     */
    static async getMerchantById(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                with: {
                    devices: true,
                    licenses: true,
                    edition: true,
                    orders: {
                        limit: 10,
                        orderBy: (0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt),
                    },
                },
            }));
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            const floorDevices = await db.query.chaslayFloorDevices.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayFloorDevices.merchantId, merchantId),
            });
            const lastSeen = pickLastAppVersion([
                ...(merchant.devices ?? []).map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSync })),
                ...floorDevices.map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSeenAt })),
            ]);
            const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchantId);
            const signage = await (0, signage_addon_1.readSignageAddon)(merchantId).catch(() => ({
                enabled: (0, signage_addon_1.isSignageAddonEnabled)(merchant.signageAddonEnabled),
                screenLimit: (0, signage_addon_1.normalizeSignageScreenLimit)(merchant.signageScreenLimit),
            }));
            const kdsOn = await (0, kds_addon_1.readKdsAddonEnabled)(merchantId).catch(() => (0, kds_addon_1.isKdsAddonEnabled)(merchant.kdsAddonEnabled));
            const odsOn = await (0, ods_addon_1.readOdsAddonEnabled)(merchantId).catch(() => (0, ods_addon_1.isOdsAddonEnabled)(merchant.odsAddonEnabled));
            return {
                ...merchant,
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
                kdsAddonEnabled: kdsOn,
                kdsEnabled: kdsOn,
                odsAddonEnabled: odsOn,
                odsEnabled: odsOn,
                editionName: merchant.edition?.name ?? null,
                planBillingPaid: merchant.planBillingPaid !== false,
                lastAppVersion: lastSeen.lastAppVersion,
                lastAppVersionSeenAt: lastSeen.lastAppVersionSeenAt,
            };
        }
        catch (error) {
            console.error("Error getting merchant:", error);
            throw error;
        }
    }
    /**
     * Create merchant (by superadmin)
     */
    static async createMerchant(email, password, businessName, _contactName, phone, address, city, country, options) {
        const db = (0, db_1.getDb)();
        try {
            const existing = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.email, email),
            });
            if (existing) {
                throw new Error("Email already registered");
            }
            const hasPassword = !!(password && password.trim().length >= 8);
            if (password && password.trim() && !hasPassword) {
                throw new Error("Password must be at least 8 characters");
            }
            // Random unusable hash when inviting merchant to set their own password
            const passwordHash = hasPassword
                ? await auth_service_1.AuthService.hashPassword(password.trim())
                : await auth_service_1.AuthService.hashPassword(cryptoRandomSecret());
            const now = new Date();
            const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
            let slug = options?.slug ? slugify(options.slug) : slugify(businessName);
            if (slug) {
                const slugTaken = await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, slug),
                });
                if (slugTaken) {
                    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
                }
            }
            const lockedModule = (0, business_module_1.normalizeBusinessModule)(options?.businessCategory);
            const merchant = await db
                .insert(db_1.schema.merchants)
                .values({
                email: String(email || "").trim().toLowerCase(),
                passwordHash,
                passwordSetAt: hasPassword ? now : null,
                name: businessName,
                phone,
                address,
                city,
                country: country || "CH",
                slug: slug || null,
                shopEnabled: options?.shopEnabled ?? true,
                status: options?.status || "trial",
                subscriptionPlan: options?.subscriptionPlan || "starter",
                trialEndsAt,
                syncApiKey: (0, chaslay_compat_service_1.generateSyncApiKey)(),
                editionId: options?.editionId || null,
                resellerId: options?.resellerId || null,
                businessCategory: lockedModule,
                maxPosPosts: normalizePosPostLimit(options?.maxPosPosts ?? 0),
                maxWaiterPosts: normalizePosPostLimit(options?.maxWaiterPosts ?? 0),
                inventoryAddonEnabled: options?.inventoryAddonEnabled === true,
                signageAddonEnabled: options?.signageAddonEnabled === true,
                signageScreenLimit: (0, signage_addon_1.normalizeSignageScreenLimit)(options?.signageScreenLimit ?? 2),
                kdsAddonEnabled: options?.kdsAddonEnabled === true,
                odsAddonEnabled: options?.odsAddonEnabled === true,
            })
                .returning();
            const created = merchant[0];
            if (options?.editionId) {
                const { EditionService } = await Promise.resolve().then(() => __importStar(require("./edition.service")));
                await EditionService.applyEditionDefaultsToMerchant(created.id, options.editionId, {
                    businessCategory: lockedModule || options?.businessCategory,
                });
            }
            else if (lockedModule) {
                const modulePatch = (0, business_module_1.businessModuleMerchantPatch)(lockedModule, {});
                await db
                    .update(db_1.schema.merchants)
                    .set(modulePatch)
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, created.id));
            }
            else if (options?.businessCategory === "retail") {
                const checkout = created.posCheckoutSettings && typeof created.posCheckoutSettings === "object"
                    ? { ...created.posCheckoutSettings }
                    : {};
                checkout.posMode = "retail";
                await db
                    .update(db_1.schema.merchants)
                    .set({
                    floorPlanEnabled: false,
                    coursesEnabled: false,
                    posCheckoutSettings: checkout,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, created.id));
            }
            let issuedLicenses = [];
            const seats = Math.max(0, Math.min(20, options?.deviceSeats ?? 0));
            if (seats > 0) {
                const { LicenseAdminService } = await Promise.resolve().then(() => __importStar(require("./license-admin.service")));
                const issued = await LicenseAdminService.issueDeviceSeats(created.id, seats, options?.licenseType || "yearly", options?.customDays, "tablet", options?.issuedByResellerId || null);
                issuedLicenses = issued;
            }
            // Default: send invite when no password was set; admin can also force sendInvite: true
            const sendInvite = options?.sendInvite ?? !hasPassword;
            let invite = null;
            if (sendInvite) {
                const { MerchantInviteService } = await Promise.resolve().then(() => __importStar(require("./merchant-invite.service")));
                invite = await MerchantInviteService.sendInviteEmail(created.id);
            }
            const refreshed = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, created.id),
            });
            const row = refreshed || created;
            if (options?.inventoryAddonEnabled === true) {
                await (0, inventory_addon_1.writeInventoryAddonEnabled)(created.id, true);
            }
            if (options?.signageAddonEnabled === true) {
                await (0, signage_addon_1.writeSignageAddonEnabled)(created.id, true);
            }
            if (options?.signageScreenLimit != null) {
                await (0, signage_addon_1.writeSignageScreenLimit)(created.id, options.signageScreenLimit);
            }
            if (options?.kdsAddonEnabled === true) {
                await (0, kds_addon_1.writeKdsAddonEnabled)(created.id, true);
            }
            if (options?.odsAddonEnabled === true) {
                await (0, ods_addon_1.writeOdsAddonEnabled)(created.id, true);
            }
            const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(created.id).catch(() => false);
            const signage = await (0, signage_addon_1.readSignageAddon)(created.id).catch(() => ({
                enabled: false,
                screenLimit: 2,
            }));
            const kdsOn = await (0, kds_addon_1.readKdsAddonEnabled)(created.id).catch(() => false);
            const odsOn = await (0, ods_addon_1.readOdsAddonEnabled)(created.id).catch(() => false);
            // Don't leak password hash to API clients
            const { passwordHash: _ph, inviteTokenHash: _ith, ...safe } = row;
            return {
                ...safe,
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
                kdsAddonEnabled: kdsOn,
                kdsEnabled: kdsOn,
                odsAddonEnabled: odsOn,
                odsEnabled: odsOn,
                issuedLicenses,
                invite,
                passwordSet: hasPassword,
            };
        }
        catch (error) {
            console.error("Error creating merchant:", error);
            throw error;
        }
    }
    /**
     * Update merchant details
     */
    static async updateMerchant(merchantId, updates) {
        const db = (0, db_1.getDb)();
        try {
            const addonRequested = updates.inventoryAddonEnabled;
            const signageRequested = updates.signageAddonEnabled;
            const kdsRequested = updates.kdsAddonEnabled;
            const odsRequested = updates.odsAddonEnabled;
            if (addonRequested !== undefined) {
                await (0, ensure_merchant_schema_1.ensureInventoryAddonColumn)();
                updates.inventoryAddonEnabled = (0, inventory_addon_1.isInventoryAddonEnabled)(addonRequested);
            }
            if (signageRequested !== undefined) {
                updates.signageAddonEnabled = (0, signage_addon_1.isSignageAddonEnabled)(signageRequested);
            }
            if (kdsRequested !== undefined) {
                updates.kdsAddonEnabled = (0, kds_addon_1.isKdsAddonEnabled)(kdsRequested);
            }
            if (odsRequested !== undefined) {
                updates.odsAddonEnabled = (0, ods_addon_1.isOdsAddonEnabled)(odsRequested);
            }
            const merchant = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db
                .update(db_1.schema.merchants)
                .set({
                ...updates,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
                .returning());
            if (addonRequested !== undefined) {
                const on = await (0, inventory_addon_1.writeInventoryAddonEnabled)(merchantId, addonRequested);
                Object.assign(merchant[0], { inventoryAddonEnabled: on });
            }
            if (signageRequested !== undefined) {
                const on = await (0, signage_addon_1.writeSignageAddonEnabled)(merchantId, signageRequested);
                Object.assign(merchant[0], { signageAddonEnabled: on, signageEnabled: on });
            }
            if (kdsRequested !== undefined) {
                const on = await (0, kds_addon_1.writeKdsAddonEnabled)(merchantId, kdsRequested);
                Object.assign(merchant[0], { kdsAddonEnabled: on, kdsEnabled: on });
            }
            if (odsRequested !== undefined) {
                const on = await (0, ods_addon_1.writeOdsAddonEnabled)(merchantId, odsRequested);
                Object.assign(merchant[0], { odsAddonEnabled: on, odsEnabled: on });
            }
            return merchant[0];
        }
        catch (error) {
            console.error("Error updating merchant:", error);
            throw error;
        }
    }
    /** POS post limits + paid addons are agency/reseller-managed — not merchant self-service. */
    static async updatePosPostLimits(merchantId, limits) {
        const patch = {};
        if (limits.maxPosPosts !== undefined) {
            patch.maxPosPosts = normalizePosPostLimit(limits.maxPosPosts);
        }
        if (limits.maxWaiterPosts !== undefined) {
            patch.maxWaiterPosts = normalizePosPostLimit(limits.maxWaiterPosts);
        }
        if (Object.keys(patch).length > 0) {
            await this.updateMerchant(merchantId, patch);
        }
        let wroteAddon = false;
        if (limits.inventoryAddonEnabled !== undefined) {
            await (0, inventory_addon_1.writeInventoryAddonEnabled)(merchantId, limits.inventoryAddonEnabled);
            wroteAddon = true;
        }
        if (limits.signageAddonEnabled !== undefined) {
            await (0, signage_addon_1.writeSignageAddonEnabled)(merchantId, limits.signageAddonEnabled);
            wroteAddon = true;
        }
        if (limits.signageScreenLimit !== undefined) {
            await (0, signage_addon_1.writeSignageScreenLimit)(merchantId, limits.signageScreenLimit);
            wroteAddon = true;
        }
        if (limits.kdsAddonEnabled !== undefined) {
            await (0, kds_addon_1.writeKdsAddonEnabled)(merchantId, limits.kdsAddonEnabled);
            wroteAddon = true;
        }
        if (limits.odsAddonEnabled !== undefined) {
            await (0, ods_addon_1.writeOdsAddonEnabled)(merchantId, limits.odsAddonEnabled);
            wroteAddon = true;
        }
        if (!wroteAddon && Object.keys(patch).length === 0) {
            throw new Error("At least one of maxPosPosts, maxWaiterPosts, inventoryAddonEnabled, signageAddonEnabled, signageScreenLimit, kdsAddonEnabled, or odsAddonEnabled is required");
        }
        return this.getMerchantById(merchantId);
    }
    /** Superadmin / owning reseller: change POS edition and plan billing flag. */
    static async updateMerchantPlan(merchantId, input, opts) {
        const hasEdition = input.editionId !== undefined;
        const hasPaid = input.planBillingPaid !== undefined;
        const hasSubPlan = input.subscriptionPlan !== undefined;
        if (!hasEdition && !hasPaid && !hasSubPlan) {
            throw new Error("At least one of editionId, planBillingPaid, or subscriptionPlan is required");
        }
        const db = (0, db_1.getDb)();
        const existing = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { id: true },
        });
        if (!existing)
            throw new Error("Merchant not found");
        const patch = {};
        if (hasPaid)
            patch.planBillingPaid = !!input.planBillingPaid;
        if (hasSubPlan) {
            const planSlug = String(input.subscriptionPlan || "").trim();
            if (!planSlug)
                throw new Error("Subscription plan is required");
            const { SubscriptionPlansService } = await Promise.resolve().then(() => __importStar(require("./subscription-plans.service")));
            const plan = await SubscriptionPlansService.getBySlug(planSlug);
            if (!plan || !plan.isActive)
                throw new Error("Subscription plan not found or inactive");
            const { PackageProvisioningService } = await Promise.resolve().then(() => __importStar(require("./package-provisioning.service")));
            await PackageProvisioningService.applyPlan(merchantId, plan.id);
        }
        if (hasEdition) {
            if (input.editionId === null) {
                if (!opts?.allowClearEdition)
                    throw new Error("POS version is required");
                patch.editionId = null;
            }
            else {
                const editionId = String(input.editionId || "").trim();
                if (!editionId)
                    throw new Error("POS version is required");
                const { EditionService } = await Promise.resolve().then(() => __importStar(require("./edition.service")));
                const edition = await EditionService.getById(editionId);
                if (!edition || !edition.isActive)
                    throw new Error("POS version not found or inactive");
                if (opts?.forResellerId) {
                    const allowedEdition = edition.ownerType === "platform" ||
                        (edition.ownerType === "reseller" && edition.ownerId === opts.forResellerId);
                    if (!allowedEdition)
                        throw new Error("POS version not available for this reseller");
                }
                if (Object.keys(patch).length) {
                    await this.updateMerchant(merchantId, patch);
                }
                await EditionService.applyEditionDefaultsToMerchant(merchantId, editionId);
                return this.getMerchantById(merchantId);
            }
        }
        if (Object.keys(patch).length) {
            await this.updateMerchant(merchantId, patch);
        }
        return this.getMerchantById(merchantId);
    }
    /** Paid addons are agency/reseller-managed — merchants cannot self-enable. */
    static async updateAddons(merchantId, addons) {
        if (addons.inventoryAddonEnabled === undefined &&
            addons.signageAddonEnabled === undefined &&
            addons.signageScreenLimit === undefined &&
            addons.kdsAddonEnabled === undefined &&
            addons.odsAddonEnabled === undefined) {
            throw new Error("No addon updates provided");
        }
        if (addons.inventoryAddonEnabled !== undefined) {
            await (0, inventory_addon_1.writeInventoryAddonEnabled)(merchantId, addons.inventoryAddonEnabled);
        }
        if (addons.signageAddonEnabled !== undefined) {
            await (0, signage_addon_1.writeSignageAddonEnabled)(merchantId, addons.signageAddonEnabled);
        }
        if (addons.signageScreenLimit !== undefined) {
            await (0, signage_addon_1.writeSignageScreenLimit)(merchantId, addons.signageScreenLimit);
        }
        if (addons.kdsAddonEnabled !== undefined) {
            await (0, kds_addon_1.writeKdsAddonEnabled)(merchantId, addons.kdsAddonEnabled);
        }
        if (addons.odsAddonEnabled !== undefined) {
            await (0, ods_addon_1.writeOdsAddonEnabled)(merchantId, addons.odsAddonEnabled);
        }
        return this.getMerchantById(merchantId);
    }
    /**
     * Suspend merchant account
     */
    static async suspendMerchant(merchantId, reason) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db
                .update(db_1.schema.merchants)
                .set({
                status: "suspended",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
                .returning();
            return merchant[0];
        }
        catch (error) {
            console.error("Error suspending merchant:", error);
            throw error;
        }
    }
    /**
     * Reactivate merchant account
     */
    static async reactivateMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db
                .update(db_1.schema.merchants)
                .set({
                status: "active",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
                .returning();
            return merchant[0];
        }
        catch (error) {
            console.error("Error reactivating merchant:", error);
            throw error;
        }
    }
    /**
     * Delete merchant (soft delete)
     */
    static async deleteMerchant(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db
                .update(db_1.schema.merchants)
                .set({
                status: "suspended",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
                .returning();
            return merchant[0];
        }
        catch (error) {
            console.error("Error deleting merchant:", error);
            throw error;
        }
    }
    /**
     * Get merchant analytics
     */
    static async getMerchantAnalytics(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            // Get order count and total revenue
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
            });
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
            // Get device count
            const devices = await db.query.devices.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchantId),
            });
            // Get license info
            const licenses = await db.query.licenses.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchantId),
            });
            const activeLicenses = licenses.filter((l) => l.status === "active").length;
            return {
                merchant: {
                    id: merchant.id,
                    name: merchant.name,
                    email: merchant.email,
                    status: merchant.status,
                    subscriptionPlan: merchant.subscriptionPlan,
                    createdAt: merchant.createdAt,
                },
                analytics: {
                    totalOrders,
                    totalRevenue,
                    deviceCount: devices.length,
                    activeLicenses,
                    trialEndsAt: merchant.trialEndsAt,
                    subscriptionEndsAt: merchant.subscriptionEndsAt,
                },
            };
        }
        catch (error) {
            console.error("Error getting merchant analytics:", error);
            throw error;
        }
    }
    /**
     * Upgrade merchant subscription
     */
    static async upgradeMerchantSubscription(merchantId, plan) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db
                .update(db_1.schema.merchants)
                .set({
                subscriptionPlan: plan,
                status: "active",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
                .returning();
            return merchant[0];
        }
        catch (error) {
            console.error("Error upgrading subscription:", error);
            throw error;
        }
    }
    /**
     * Get merchants by status
     */
    static async getMerchantsByStatus(status) {
        const db = (0, db_1.getDb)();
        try {
            const merchants = await db.query.merchants.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.status, status),
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.merchants.createdAt),
            });
            return merchants;
        }
        catch (error) {
            console.error("Error getting merchants by status:", error);
            throw error;
        }
    }
    /**
     * Get merchants with expiring licenses
     */
    static async getMerchantsWithExpiringLicenses(daysThreshold = 35) {
        const db = (0, db_1.getDb)();
        try {
            const now = new Date();
            const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
            const licenses = await db.query.licenses.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active"), (0, drizzle_orm_1.lt)(db_1.schema.licenses.expiresAt, thresholdDate), (0, drizzle_orm_1.gt)(db_1.schema.licenses.expiresAt, now)),
                with: {
                    merchant: true,
                },
            });
            return licenses.map((l) => ({
                merchant: l.merchant,
                expiresAt: l.expiresAt,
                daysRemaining: Math.ceil((l.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            }));
        }
        catch (error) {
            console.error("Error getting merchants with expiring licenses:", error);
            throw error;
        }
    }
}
exports.MerchantService = MerchantService;
//# sourceMappingURL=merchant.service.js.map