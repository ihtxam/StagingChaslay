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
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
class AuthService {
    /**
     * Hash a password
     */
    static async hashPassword(password) {
        return bcrypt_1.default.hash(password, this.SALT_ROUNDS);
    }
    /**
     * Compare password with hash
     */
    static async comparePassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    /**
     * Generate JWT token
     */
    static generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRY,
        });
    }
    /**
     * Verify JWT token
     */
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
        }
        catch (error) {
            throw new Error("Invalid or expired token");
        }
    }
    /**
     * Register a new merchant
     */
    static async registerMerchant(email, password, name, businessName) {
        const db = (0, db_1.getDb)();
        try {
            // Check if merchant already exists
            const existing = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.email, email),
            });
            if (existing) {
                throw new Error("Merchant already exists");
            }
            // Hash password
            const passwordHash = await this.hashPassword(password);
            // Create merchant
            const merchant = await db
                .insert(db_1.schema.merchants)
                .values({
                email,
                passwordHash,
                name: businessName,
                status: "active",
                subscriptionPlan: "free",
            })
                .returning();
            return {
                id: merchant[0].id,
                email: merchant[0].email,
                name: merchant[0].name,
            };
        }
        catch (error) {
            console.error("Error registering merchant:", error);
            throw error;
        }
    }
    /**
     * Login merchant owner or staff with panel access
     */
    static async loginMerchant(email, password) {
        try {
            return await this.loginMerchantOwner(email, password);
        }
        catch (ownerError) {
            const ownerMessage = ownerError instanceof Error ? ownerError.message : "";
            if (ownerMessage.startsWith("Merchant account is")) {
                throw ownerError;
            }
            try {
                return await this.loginMerchantStaff(email, password);
            }
            catch (staffError) {
                const staffMessage = staffError instanceof Error ? staffError.message : "";
                const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
                if (StaffService.isLoginGuidanceError(staffMessage)) {
                    throw staffError;
                }
                throw ownerError;
            }
        }
    }
    static async loginMerchantOwner(email, password) {
        const db = (0, db_1.getDb)();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const merchants = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db
            .select()
            .from(db_1.schema.merchants)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchants.email}) = ${normalizedEmail}`)
            .limit(1));
        const merchant = merchants[0];
        if (!merchant) {
            throw new Error("Invalid email or password");
        }
        const isValid = await this.comparePassword(password, merchant.passwordHash);
        if (!isValid) {
            throw new Error("Invalid email or password");
        }
        if (merchant.status !== "active" && merchant.status !== "trial") {
            throw new Error(`Merchant account is ${merchant.status}`);
        }
        const token = this.generateToken({
            id: merchant.id,
            email: merchant.email,
            role: "merchant",
            merchantId: merchant.id,
            name: merchant.name,
        });
        const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchant.id).catch(() => (0, inventory_addon_1.isInventoryAddonEnabled)(merchant.inventoryAddonEnabled));
        const signage = await (0, signage_addon_1.readSignageAddon)(merchant.id).catch(() => ({
            enabled: (0, signage_addon_1.isSignageAddonEnabled)(merchant.signageAddonEnabled),
            screenLimit: 2,
        }));
        return {
            token,
            merchant: {
                id: merchant.id,
                email: merchant.email,
                name: merchant.name,
                status: merchant.status,
                roleName: "Owner",
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
            },
            isOwner: true,
        };
    }
    static async loginMerchantStaff(email, password) {
        const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
        const { staff, role, permissions } = await StaffService.loginStaff(email, password);
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, staff.merchantId),
            columns: { status: true },
        });
        if (!merchant || (merchant.status !== "active" && merchant.status !== "trial")) {
            throw new Error(`Merchant account is ${merchant?.status || "unavailable"}`);
        }
        const token = this.generateToken({
            id: staff.id,
            email: staff.email || email,
            role: "staff",
            merchantId: staff.merchantId,
            staffId: staff.id,
            name: staff.name,
            roleName: role?.name,
            permissions,
        });
        const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(staff.merchantId).catch(() => false);
        const signage = await (0, signage_addon_1.readSignageAddon)(staff.merchantId).catch(() => ({
            enabled: false,
            screenLimit: 2,
        }));
        return {
            token,
            merchant: {
                id: staff.merchantId,
                email: staff.email || email,
                name: staff.name,
                status: "active",
                staffId: staff.id,
                roleName: role?.name,
                permissions,
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
            },
            isOwner: false,
        };
    }
    /**
     * Register superadmin
     */
    static async registerSuperadmin(email, password, name) {
        const db = (0, db_1.getDb)();
        try {
            // Check if superadmin already exists
            const existing = await db.query.superadmins.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.superadmins.email, email),
            });
            if (existing) {
                throw new Error("Superadmin already exists");
            }
            // Hash password
            const passwordHash = await this.hashPassword(password);
            // Create superadmin
            const superadmin = await db
                .insert(db_1.schema.superadmins)
                .values({
                email,
                passwordHash,
                name,
                role: "superadmin",
                isActive: true,
            })
                .returning();
            return {
                id: superadmin[0].id,
                email: superadmin[0].email,
                name: superadmin[0].name,
            };
        }
        catch (error) {
            console.error("Error registering superadmin:", error);
            throw error;
        }
    }
    /**
     * Unified panel login — merchant owner → staff → reseller → superadmin.
     * Does not replace PIN WebPOS or waiter PIN.
     */
    static async loginAny(email, password) {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized || !password) {
            throw new Error("Email and password are required");
        }
        try {
            const merchant = await this.loginMerchantOwner(normalized, password);
            return {
                kind: "merchant",
                token: merchant.token,
                merchant: merchant.merchant,
                isOwner: true,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (message.startsWith("Merchant account is")) {
                throw error;
            }
        }
        try {
            const staff = await this.loginMerchantStaff(normalized, password);
            return {
                kind: "staff",
                token: staff.token,
                merchant: staff.merchant,
                isOwner: false,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "";
            const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
            if (StaffService.isLoginGuidanceError(message)) {
                throw error;
            }
        }
        try {
            const { ResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller.service")));
            const reseller = await ResellerService.login(normalized, password);
            return { kind: "reseller", token: reseller.token, reseller: reseller.reseller };
        }
        catch {
            /* try superadmin */
        }
        const db = (0, db_1.getDb)();
        const rows = await db
            .select()
            .from(db_1.schema.superadmins)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.superadmins.email}) = ${normalized}`)
            .limit(1);
        const superadmin = rows[0];
        if (superadmin && superadmin.isActive) {
            const ok = await this.comparePassword(password, superadmin.passwordHash);
            if (ok) {
                const token = this.generateToken({
                    id: superadmin.id,
                    email: superadmin.email,
                    role: "superadmin",
                });
                return {
                    kind: "superadmin",
                    token,
                    superadmin: { id: superadmin.id, email: superadmin.email, name: superadmin.name },
                };
            }
        }
        throw new Error("Invalid email or password");
    }
    /**
     * Login superadmin
     */
    static async loginSuperadmin(email, password) {
        const db = (0, db_1.getDb)();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        try {
            const rows = await db
                .select()
                .from(db_1.schema.superadmins)
                .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.superadmins.email}) = ${normalizedEmail}`)
                .limit(1);
            const superadmin = rows[0];
            if (!superadmin) {
                throw new Error("Invalid email or password");
            }
            // Verify password
            const isValid = await this.comparePassword(password, superadmin.passwordHash);
            if (!isValid) {
                throw new Error("Invalid email or password");
            }
            // Check if superadmin is active
            if (!superadmin.isActive) {
                throw new Error("Superadmin account is inactive");
            }
            // Generate token
            const token = this.generateToken({
                id: superadmin.id,
                email: superadmin.email,
                role: "superadmin",
            });
            return {
                token,
                superadmin: {
                    id: superadmin.id,
                    email: superadmin.email,
                    name: superadmin.name,
                },
            };
        }
        catch (error) {
            console.error("Error logging in superadmin:", error);
            throw error;
        }
    }
    /**
     * Issue a merchant JWT so a superadmin can open that merchant's panel.
     */
    static async impersonateMerchant(superadminId, merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant) {
            throw new Error("Merchant not found");
        }
        if (merchant.status === "suspended" || merchant.status === "expired") {
            throw new Error(`Cannot open panel: merchant is ${merchant.status}`);
        }
        const token = this.generateToken({
            id: merchant.id,
            email: merchant.email,
            role: "merchant",
            merchantId: merchant.id,
            name: merchant.name,
            impersonatedBy: superadminId,
        });
        const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchant.id).catch(() => (0, inventory_addon_1.isInventoryAddonEnabled)(merchant.inventoryAddonEnabled));
        const signage = await (0, signage_addon_1.readSignageAddon)(merchant.id).catch(() => ({
            enabled: (0, signage_addon_1.isSignageAddonEnabled)(merchant.signageAddonEnabled),
            screenLimit: 2,
        }));
        return {
            token,
            merchant: {
                id: merchant.id,
                email: merchant.email,
                name: merchant.name,
                status: merchant.status,
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
            },
            impersonatedBy: superadminId,
        };
    }
    /**
     * Verify merchant email (for password reset, etc.)
     */
    static async getMerchantById(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(() => db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            }));
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            const inventoryOn = await (0, inventory_addon_1.readInventoryAddonEnabled)(merchantId).catch(() => (0, inventory_addon_1.isInventoryAddonEnabled)(merchant.inventoryAddonEnabled));
            const signage = await (0, signage_addon_1.readSignageAddon)(merchantId).catch(() => ({
                enabled: (0, signage_addon_1.isSignageAddonEnabled)(merchant.signageAddonEnabled),
                screenLimit: 2,
            }));
            return {
                id: merchant.id,
                email: merchant.email,
                name: merchant.name,
                status: merchant.status,
                inventoryAddonEnabled: inventoryOn,
                inventoryEnabled: inventoryOn,
                signageAddonEnabled: signage.enabled,
                signageEnabled: signage.enabled,
                signageScreenLimit: signage.screenLimit,
            };
        }
        catch (error) {
            console.error("Error getting merchant:", error);
            throw error;
        }
    }
    /**
     * Update merchant password
     */
    static async updateMerchantPassword(merchantId, newPassword) {
        const db = (0, db_1.getDb)();
        try {
            const passwordHash = await this.hashPassword(newPassword);
            await db
                .update(db_1.schema.merchants)
                .set({ passwordHash })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return { success: true };
        }
        catch (error) {
            console.error("Error updating password:", error);
            throw error;
        }
    }
    /**
     * Temporary login-page password reset (merchants / staff / superadmin by email).
     * Disable with ALLOW_LOGIN_PASSWORD_RESET=0.
     */
    static async resetLoginPasswordByEmail(role, email, newPassword) {
        if (process.env.ALLOW_LOGIN_PASSWORD_RESET === "0") {
            throw new Error("Password reset from login is disabled");
        }
        const normalized = email.trim().toLowerCase();
        if (!normalized)
            throw new Error("Email is required");
        if (!newPassword || newPassword.length < 8) {
            throw new Error("Password must be at least 8 characters");
        }
        const db = (0, db_1.getDb)();
        const passwordHash = await this.hashPassword(newPassword);
        if (role === "merchant") {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.email, normalized),
            });
            if (!merchant)
                throw new Error("Merchant not found");
            await db
                .update(db_1.schema.merchants)
                .set({ passwordHash, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
            return { success: true, role: "merchant", email: merchant.email };
        }
        if (role === "staff") {
            const staffRows = await db
                .select()
                .from(db_1.schema.merchantStaff)
                .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchantStaff.email}) = ${normalized}`)
                .limit(1);
            const staff = staffRows[0];
            if (!staff)
                throw new Error("Staff user not found");
            await db
                .update(db_1.schema.merchantStaff)
                .set({ passwordHash, canAccessPanel: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staff.id));
            return { success: true, role: "staff", email: staff.email || normalized };
        }
        if (role === "superadmin") {
            const admin = await db.query.superadmins.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.superadmins.email, normalized),
            });
            if (!admin)
                throw new Error("Superadmin not found");
            await db
                .update(db_1.schema.superadmins)
                .set({ passwordHash, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, admin.id));
            return { success: true, role: "superadmin", email: admin.email };
        }
        // reseller
        const { ResellerService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller.service")));
        const reseller = await db.query.resellers.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.resellers.email, normalized),
        });
        if (!reseller)
            throw new Error("Reseller not found");
        await ResellerService.update(reseller.id, { password: newPassword });
        return { success: true, role: "reseller", email: reseller.email };
    }
}
exports.AuthService = AuthService;
AuthService.SALT_ROUNDS = 10;
AuthService.JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
AuthService.JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";
//# sourceMappingURL=auth.service.js.map