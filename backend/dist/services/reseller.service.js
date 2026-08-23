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
exports.ResellerService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const auth_service_1 = require("@/services/auth.service");
const edition_service_1 = require("@/services/edition.service");
const merchant_service_1 = require("@/services/merchant.service");
const license_admin_service_1 = require("@/services/license-admin.service");
const reseller_billing_service_1 = require("@/services/reseller-billing.service");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
function serializeReseller(row, extras) {
    const licenseSeats = row.licenseSeats ?? 0;
    const seatsUsed = extras?.seatsUsed ?? 0;
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        branding: row.branding,
        createdBySuperadminId: row.createdBySuperadminId,
        licenseSeats,
        seatsUsed,
        seatsRemaining: Math.max(0, licenseSeats - seatsUsed),
        merchantCount: extras?.merchantCount ?? 0,
        activeOrTrialCount: extras?.activeOrTrialCount ?? 0,
        suspendedCount: extras?.suspendedCount ?? 0,
        billableMerchantCount: extras?.billableMerchantCount ?? 0,
        deviceCount: extras?.deviceCount ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
class ResellerService {
    static async countSeatsUsed(resellerId) {
        const db = (0, db_1.getDb)();
        // Active seats only ? revoked/suspended licenses free pool capacity
        const [{ c }] = await db
            .select({ c: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.licenses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.issuedByResellerId, resellerId), (0, drizzle_orm_1.eq)(db_1.schema.licenses.status, "active")));
        return Number(c || 0);
    }
    static async getSeatPool(resellerId) {
        const db = (0, db_1.getDb)();
        const row = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, resellerId),
        });
        if (!row)
            throw new Error("Reseller not found");
        const seatsUsed = await this.countSeatsUsed(resellerId);
        return {
            licenseSeats: row.licenseSeats ?? 0,
            seatsUsed,
            seatsRemaining: Math.max(0, (row.licenseSeats ?? 0) - seatsUsed),
        };
    }
    static async assertSeatCapacity(resellerId, seatsNeeded) {
        const need = Math.max(0, Math.floor(seatsNeeded));
        if (need <= 0)
            return this.getSeatPool(resellerId);
        const pool = await this.getSeatPool(resellerId);
        if (pool.seatsRemaining < need) {
            throw new Error(`Insufficient license seats: need ${need}, remaining ${pool.seatsRemaining} (allocated ${pool.licenseSeats})`);
        }
        return pool;
    }
    /** Superadmin sets absolute allocated seat pool (or delta via mode). */
    static async allocateLicenseSeats(resellerId, input) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, resellerId),
        });
        if (!existing)
            throw new Error("Reseller not found");
        let next = existing.licenseSeats ?? 0;
        if (input.seats != null) {
            next = Math.max(0, Math.floor(Number(input.seats)));
        }
        else if (input.delta != null) {
            next = Math.max(0, next + Math.floor(Number(input.delta)));
        }
        else {
            throw new Error("Provide seats (absolute) or delta");
        }
        const seatsUsed = await this.countSeatsUsed(resellerId);
        if (next < seatsUsed) {
            throw new Error(`Cannot set allocated seats to ${next}: ${seatsUsed} already issued to merchants`);
        }
        const [row] = await db
            .update(db_1.schema.resellers)
            .set({ licenseSeats: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.resellers.id, resellerId))
            .returning();
        return this.getById(row.id);
    }
    static async ensureChaslayAgency(createdBySuperadminId) {
        const db = (0, db_1.getDb)();
        const email = (process.env.SEED_RESELLER_EMAIL || "agency@chaslay.com").toLowerCase();
        const existing = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, email),
        });
        if (existing)
            return serializeReseller(existing);
        const password = process.env.SEED_RESELLER_PASSWORD || "ChaslayAgency123!";
        const name = process.env.SEED_RESELLER_NAME || "Chaslay";
        const passwordHash = await auth_service_1.AuthService.hashPassword(password);
        const [row] = await db
            .insert(db_1.schema.resellers)
            .values({
            name,
            email,
            passwordHash,
            status: "active",
            createdBySuperadminId: createdBySuperadminId || null,
        })
            .returning();
        // Attach legacy merchants without reseller to this agency + Full edition
        const fullId = await edition_service_1.EditionService.getLegacyFullEditionId();
        if (row) {
            await db
                .update(db_1.schema.merchants)
                .set({ resellerId: row.id, updatedAt: new Date() })
                .where((0, drizzle_orm_1.isNull)(db_1.schema.merchants.resellerId));
            if (fullId) {
                await db
                    .update(db_1.schema.merchants)
                    .set({ editionId: fullId, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchants.resellerId, row.id), (0, drizzle_orm_1.isNull)(db_1.schema.merchants.editionId)));
            }
        }
        return serializeReseller(row);
    }
    static async list(opts) {
        await this.ensureChaslayAgency();
        const db = (0, db_1.getDb)();
        const clauses = [];
        if (opts?.status)
            clauses.push((0, drizzle_orm_1.eq)(db_1.schema.resellers.status, opts.status));
        if (opts?.search?.trim()) {
            const q = `%${opts.search.trim()}%`;
            clauses.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(db_1.schema.resellers.name, q), (0, drizzle_orm_1.ilike)(db_1.schema.resellers.email, q)));
        }
        const rows = await db
            .select()
            .from(db_1.schema.resellers)
            .where(clauses.length ? (0, drizzle_orm_1.and)(...clauses) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.resellers.createdAt));
        const statsMap = await reseller_billing_service_1.ResellerBillingService.getResellerStatsMap(rows.map((r) => r.id));
        return rows.map((r) => {
            const st = statsMap.get(r.id);
            return serializeReseller(r, {
                merchantCount: st?.merchantCount || 0,
                seatsUsed: st?.seatsUsed || 0,
                activeOrTrialCount: st?.activeOrTrialCount || 0,
                suspendedCount: st?.suspendedCount || 0,
                billableMerchantCount: st?.billableMerchantCount || 0,
                deviceCount: st?.deviceCount || 0,
            });
        });
    }
    static async getById(id) {
        const db = (0, db_1.getDb)();
        const row = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, id),
        });
        if (!row)
            return null;
        const statsMap = await reseller_billing_service_1.ResellerBillingService.getResellerStatsMap([id]);
        const st = statsMap.get(id);
        return serializeReseller(row, {
            merchantCount: st?.merchantCount || 0,
            seatsUsed: st?.seatsUsed || 0,
            activeOrTrialCount: st?.activeOrTrialCount || 0,
            suspendedCount: st?.suspendedCount || 0,
            billableMerchantCount: st?.billableMerchantCount || 0,
            deviceCount: st?.deviceCount || 0,
        });
    }
    static async create(input) {
        const db = (0, db_1.getDb)();
        const email = String(input.email || "").trim().toLowerCase();
        if (!email || !input.name?.trim())
            throw new Error("Name and email are required");
        if (!input.password || input.password.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }
        const existing = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, email),
        });
        if (existing)
            throw new Error("Email already registered");
        const passwordHash = await auth_service_1.AuthService.hashPassword(input.password);
        const [row] = await db
            .insert(db_1.schema.resellers)
            .values({
            name: input.name.trim(),
            email,
            passwordHash,
            phone: input.phone?.trim() || null,
            status: "active",
            licenseSeats: Math.max(0, Math.floor(Number(input.licenseSeats) || 0)),
            createdBySuperadminId: input.createdBySuperadminId || null,
        })
            .returning();
        return serializeReseller(row);
    }
    static async update(id, input) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.id, id),
        });
        if (!existing)
            throw new Error("Reseller not found");
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = input.name.trim();
        if (input.phone !== undefined)
            patch.phone = input.phone?.trim() || null;
        if (input.status !== undefined) {
            patch.status = ["active", "suspended"].includes(input.status) ? input.status : existing.status;
        }
        if (input.password) {
            if (input.password.length < 8)
                throw new Error("Password must be at least 8 characters");
            patch.passwordHash = await auth_service_1.AuthService.hashPassword(input.password);
        }
        if (input.licenseSeats !== undefined) {
            const next = Math.max(0, Math.floor(Number(input.licenseSeats)));
            const seatsUsed = await this.countSeatsUsed(id);
            if (next < seatsUsed) {
                throw new Error(`Cannot set allocated seats to ${next}: ${seatsUsed} already issued to merchants`);
            }
            patch.licenseSeats = next;
        }
        const [row] = await db
            .update(db_1.schema.resellers)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.resellers.id, id))
            .returning();
        return this.getById(row.id);
    }
    static async login(email, password) {
        const db = (0, db_1.getDb)();
        const row = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, String(email || "").trim().toLowerCase()),
        });
        if (!row || row.status !== "active")
            throw new Error("Invalid credentials");
        const ok = await auth_service_1.AuthService.comparePassword(password, row.passwordHash);
        if (!ok)
            throw new Error("Invalid credentials");
        const token = auth_service_1.AuthService.generateToken({
            id: row.id,
            email: row.email,
            role: "reseller",
            name: row.name,
            resellerId: row.id,
        });
        return {
            token,
            reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" },
        };
    }
    static async impersonateToken(resellerId, impersonatedBy) {
        const row = await this.getById(resellerId);
        if (!row)
            throw new Error("Reseller not found");
        if (row.status !== "active")
            throw new Error("Reseller is suspended");
        const token = auth_service_1.AuthService.generateToken({
            id: row.id,
            email: row.email,
            role: "reseller",
            name: row.name,
            resellerId: row.id,
            impersonatedBy,
        });
        return {
            token,
            reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" },
        };
    }
    static async listMerchants(resellerId, opts) {
        const db = (0, db_1.getDb)();
        const clauses = [(0, drizzle_orm_1.eq)(db_1.schema.merchants.resellerId, resellerId)];
        if (opts?.status)
            clauses.push((0, drizzle_orm_1.eq)(db_1.schema.merchants.status, opts.status));
        if (opts?.search?.trim()) {
            const q = `%${opts.search.trim()}%`;
            clauses.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(db_1.schema.merchants.name, q), (0, drizzle_orm_1.ilike)(db_1.schema.merchants.email, q), (0, drizzle_orm_1.ilike)(db_1.schema.merchants.slug, q)));
        }
        const rows = await db
            .select({
            id: db_1.schema.merchants.id,
            name: db_1.schema.merchants.name,
            email: db_1.schema.merchants.email,
            status: db_1.schema.merchants.status,
            slug: db_1.schema.merchants.slug,
            editionId: db_1.schema.merchants.editionId,
            editionName: db_1.schema.editions.name,
            subscriptionPlan: db_1.schema.merchants.subscriptionPlan,
            planBillingPaid: db_1.schema.merchants.planBillingPaid,
            shopEnabled: db_1.schema.merchants.shopEnabled,
            maxPosPosts: db_1.schema.merchants.maxPosPosts,
            maxWaiterPosts: db_1.schema.merchants.maxWaiterPosts,
            inventoryAddonEnabled: db_1.schema.merchants.inventoryAddonEnabled,
            signageAddonEnabled: db_1.schema.merchants.signageAddonEnabled,
            signageScreenLimit: db_1.schema.merchants.signageScreenLimit,
            kdsAddonEnabled: db_1.schema.merchants.kdsAddonEnabled,
            odsAddonEnabled: db_1.schema.merchants.odsAddonEnabled,
            createdAt: db_1.schema.merchants.createdAt,
        })
            .from(db_1.schema.merchants)
            .leftJoin(db_1.schema.editions, (0, drizzle_orm_1.eq)(db_1.schema.merchants.editionId, db_1.schema.editions.id))
            .where((0, drizzle_orm_1.and)(...clauses))
            .orderBy((0, drizzle_orm_1.desc)(db_1.schema.merchants.createdAt));
        return rows.map((r) => ({
            ...r,
            editionName: r.editionName ?? null,
            planBillingPaid: r.planBillingPaid !== false,
            inventoryAddonEnabled: (0, inventory_addon_1.isInventoryAddonEnabled)(r.inventoryAddonEnabled),
            signageAddonEnabled: (0, signage_addon_1.isSignageAddonEnabled)(r.signageAddonEnabled),
            signageScreenLimit: (0, signage_addon_1.normalizeSignageScreenLimit)(r.signageScreenLimit),
            kdsAddonEnabled: r.kdsAddonEnabled === true,
            odsAddonEnabled: r.odsAddonEnabled === true,
        }));
    }
    static async createMerchantForReseller(resellerId, input) {
        const reseller = await this.getById(resellerId);
        if (!reseller || reseller.status !== "active")
            throw new Error("Reseller not available");
        const edition = await edition_service_1.EditionService.getById(input.editionId);
        if (!edition || !edition.isActive)
            throw new Error("Invalid edition");
        const allowedOwner = (edition.ownerType === "platform" && !edition.ownerId) ||
            (edition.ownerType === "reseller" && edition.ownerId === resellerId);
        if (!allowedOwner)
            throw new Error("Edition not available for this reseller");
        const seats = Math.max(0, Math.min(20, Number(input.deviceSeats) || 0));
        if (seats > 0) {
            await this.assertSeatCapacity(resellerId, seats);
        }
        const created = await merchant_service_1.MerchantService.createMerchant(input.email, input.password, input.businessName, undefined, input.phone, input.address, input.city, input.country, {
            shopEnabled: input.shopEnabled,
            deviceSeats: seats,
            licenseType: input.licenseType,
            customDays: input.customDays,
            issuedByResellerId: seats > 0 ? resellerId : undefined,
            sendInvite: input.sendInvite,
            editionId: input.editionId,
            resellerId,
            businessCategory: input.businessCategory,
            maxPosPosts: input.maxPosPosts,
            maxWaiterPosts: input.maxWaiterPosts,
            inventoryAddonEnabled: input.inventoryAddonEnabled,
            signageAddonEnabled: input.signageAddonEnabled,
            signageScreenLimit: input.signageScreenLimit,
            kdsAddonEnabled: input.kdsAddonEnabled,
            odsAddonEnabled: input.odsAddonEnabled,
        });
        return created;
    }
    static async updateMerchantPosLimits(resellerId, merchantId, limits) {
        await this.assertOwnsMerchant(resellerId, merchantId);
        const { MerchantService } = await Promise.resolve().then(() => __importStar(require("./merchant.service")));
        await MerchantService.updatePosPostLimits(merchantId, {
            maxPosPosts: limits.maxPosPosts,
            maxWaiterPosts: limits.maxWaiterPosts,
            inventoryAddonEnabled: limits.inventoryAddonEnabled,
            signageAddonEnabled: limits.signageAddonEnabled,
            signageScreenLimit: limits.signageScreenLimit,
            kdsAddonEnabled: limits.kdsAddonEnabled,
            odsAddonEnabled: limits.odsAddonEnabled,
        });
        return MerchantService.getMerchantById(merchantId);
    }
    /** Change POS edition / billing flag for an owned merchant. */
    static async updateOwnedMerchantPlan(resellerId, merchantId, input) {
        await this.assertOwnsMerchant(resellerId, merchantId);
        const { MerchantService } = await Promise.resolve().then(() => __importStar(require("./merchant.service")));
        return MerchantService.updateMerchantPlan(merchantId, input, { forResellerId: resellerId });
    }
    /** Suspend a merchant this reseller owns. Same status flag as superadmin suspend. */
    static async suspendOwnedMerchant(resellerId, merchantId, reason) {
        const owned = await this.assertOwnsMerchant(resellerId, merchantId);
        if (owned.status === "expired") {
            throw new Error("Cannot suspend an expired merchant");
        }
        if (owned.status === "suspended") {
            return owned;
        }
        const { MerchantService } = await Promise.resolve().then(() => __importStar(require("./merchant.service")));
        return MerchantService.suspendMerchant(merchantId, reason);
    }
    /** Reactivate a merchant this reseller previously suspended. */
    static async reactivateOwnedMerchant(resellerId, merchantId) {
        const owned = await this.assertOwnsMerchant(resellerId, merchantId);
        if (owned.status !== "suspended") {
            throw new Error("Merchant is not suspended");
        }
        const { MerchantService } = await Promise.resolve().then(() => __importStar(require("./merchant.service")));
        return MerchantService.reactivateMerchant(merchantId);
    }
    static async assertOwnsMerchant(resellerId, merchantId) {
        const db = (0, db_1.getDb)();
        const m = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchants.resellerId, resellerId)),
            columns: { id: true, status: true, name: true },
        });
        if (!m)
            throw new Error("Merchant not found");
        return m;
    }
    /**
     * List licenses for merchants owned by this reseller only.
     */
    static async listLicenses(resellerId, opts) {
        const db = (0, db_1.getDb)();
        const page = Math.max(1, opts?.page || 1);
        const limit = Math.min(100, Math.max(1, opts?.limit || 20));
        const offset = (page - 1) * limit;
        const owned = await db
            .select({ id: db_1.schema.merchants.id })
            .from(db_1.schema.merchants)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.resellerId, resellerId));
        const merchantIds = owned.map((m) => m.id);
        if (!merchantIds.length)
            return [];
        if (opts?.merchantId && !merchantIds.includes(opts.merchantId)) {
            throw new Error("Merchant not found");
        }
        const clauses = [
            opts?.merchantId
                ? (0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, opts.merchantId)
                : (0, drizzle_orm_1.inArray)(db_1.schema.licenses.merchantId, merchantIds),
        ];
        if (opts?.status)
            clauses.push((0, drizzle_orm_1.eq)(db_1.schema.licenses.status, opts.status));
        return db.query.licenses.findMany({
            where: (0, drizzle_orm_1.and)(...clauses),
            with: { merchant: true, device: true },
            limit,
            offset,
            orderBy: (0, drizzle_orm_1.desc)(db_1.schema.licenses.createdAt),
        });
    }
    /** Issue device seats from reseller pool to an owned merchant. */
    static async issueDeviceSeats(resellerId, input) {
        await this.assertOwnsMerchant(resellerId, input.merchantId);
        if (input.mode === "device" || input.posDeviceId?.trim()) {
            // New seats need pool capacity; reuse of an existing active license is free.
            const poolBefore = await this.getSeatPool(resellerId);
            if (poolBefore.seatsRemaining < 1) {
                // Still allow returning an existing active code (no new seat)
                const peek = await license_admin_service_1.LicenseAdminService.issueForPosDeviceId(input.merchantId, String(input.posDeviceId || "").trim(), input.licenseType || "yearly", input.customDays, input.deviceType || "tablet", null);
                if (!peek.reused) {
                    await license_admin_service_1.LicenseAdminService.revokeLicense(peek.licenseId);
                    throw new Error(`Insufficient license seats: need 1, remaining 0 (allocated ${poolBefore.licenseSeats})`);
                }
                return {
                    licenses: [
                        {
                            deviceId: peek.deviceId,
                            deviceName: peek.deviceName,
                            licenseKey: peek.licenseKey,
                            expiresAt: peek.expiresAt,
                            licenseId: peek.licenseId,
                            externalDeviceId: peek.externalDeviceId,
                            reused: true,
                        },
                    ],
                    pool: poolBefore,
                };
            }
            const result = await license_admin_service_1.LicenseAdminService.issueForPosDeviceId(input.merchantId, String(input.posDeviceId || "").trim(), input.licenseType || "yearly", input.customDays, input.deviceType || "tablet", resellerId);
            return {
                licenses: [
                    {
                        deviceId: result.deviceId,
                        deviceName: result.deviceName,
                        licenseKey: result.licenseKey,
                        expiresAt: result.expiresAt,
                        licenseId: result.licenseId,
                        externalDeviceId: result.externalDeviceId,
                        reused: result.reused,
                    },
                ],
                pool: await this.getSeatPool(resellerId),
            };
        }
        const seats = Math.max(1, Math.min(20, Number(input.seats) || 1));
        await this.assertSeatCapacity(resellerId, seats);
        const issued = await license_admin_service_1.LicenseAdminService.issueDeviceSeats(input.merchantId, seats, input.licenseType || "yearly", input.customDays, input.deviceType || "tablet", resellerId);
        return { licenses: issued, pool: await this.getSeatPool(resellerId) };
    }
    static async revokeOwnedLicense(resellerId, licenseId) {
        const db = (0, db_1.getDb)();
        const license = await db.query.licenses.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId),
            with: { merchant: true },
        });
        if (!license || license.merchant?.resellerId !== resellerId) {
            throw new Error("License not found");
        }
        return license_admin_service_1.LicenseAdminService.revokeLicense(licenseId);
    }
    static async extendOwnedLicense(resellerId, licenseId, additionalDays) {
        const db = (0, db_1.getDb)();
        const license = await db.query.licenses.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.licenses.id, licenseId),
            with: { merchant: true },
        });
        if (!license || license.merchant?.resellerId !== resellerId) {
            throw new Error("License not found");
        }
        return license_admin_service_1.LicenseAdminService.extendLicense(licenseId, additionalDays);
    }
}
exports.ResellerService = ResellerService;
//# sourceMappingURL=reseller.service.js.map