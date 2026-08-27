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
exports.ALL_PERMISSIONS = exports.StaffService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const auth_service_1 = require("@/services/auth.service");
const permissions_1 = require("@/lib/permissions");
Object.defineProperty(exports, "ALL_PERMISSIONS", { enumerable: true, get: function () { return permissions_1.ALL_PERMISSIONS; } });
class StaffService {
    static isLoginGuidanceError(message) {
        return (message === this.PIN_ONLY_LOGIN_MESSAGE ||
            message === this.NO_PASSWORD_LOGIN_MESSAGE ||
            message === this.NO_ENTRY_PERMISSION_MESSAGE);
    }
    static async ensureDefaultRoles(merchantId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        if (existing.length === 0) {
            await db.insert(db_1.schema.merchantRoles).values(permissions_1.DEFAULT_ROLE_TEMPLATES.map((t) => ({
                merchantId,
                name: t.name,
                permissions: (0, permissions_1.encodePermissions)(t.permissions),
                isSystem: t.isSystem,
                sortOrder: t.sortOrder,
            })));
        }
        else {
            const have = new Set(existing.map((r) => r.name.trim().toLowerCase()));
            const missing = permissions_1.DEFAULT_ROLE_TEMPLATES.filter((t) => !have.has(t.name.trim().toLowerCase()));
            if (missing.length) {
                await db.insert(db_1.schema.merchantRoles).values(missing.map((t) => ({
                    merchantId,
                    name: t.name,
                    permissions: (0, permissions_1.encodePermissions)(t.permissions),
                    isSystem: t.isSystem,
                    sortOrder: t.sortOrder,
                })));
            }
        }
        // Existing Manager roles that already see company reports keep VIEW_ALL_SALES.
        await this.ensureManagerViewAllSales(merchantId);
        // Waiters: never panel / drawer / company sales. Menu + orders stay role-assigned.
        await this.enforceWaiterFloorRestrictions(merchantId);
        return db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
    }
    /** Grant VIEW_ALL_SALES to system Manager roles that already have company report access. */
    static async ensureManagerViewAllSales(merchantId) {
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.isSystem, true)),
        });
        for (const role of roles) {
            if (!role.name.trim().toLowerCase().startsWith("manager"))
                continue;
            const perms = (0, permissions_1.parsePermissions)(role.permissions);
            if (perms.includes("VIEW_ALL_SALES"))
                continue;
            if (!perms.includes("VIEW_REPORTS") && !perms.includes("END_OF_DAY"))
                continue;
            await db
                .update(db_1.schema.merchantRoles)
                .set({
                permissions: (0, permissions_1.encodePermissions)([...perms, "VIEW_ALL_SALES"]),
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, role.id));
        }
    }
    /** @deprecated use enforceWaiterFloorRestrictions */
    static async enforceWaiterReportRestrictions(merchantId) {
        return this.enforceWaiterFloorRestrictions(merchantId);
    }
    /**
     * Strip full panel / company sales from system Waiter templates.
     * Menu, orders, and own-sales EOD (END_OF_DAY) stay as assigned on the Roles page.
     */
    static async enforceWaiterFloorRestrictions(merchantId) {
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.isSystem, true)),
        });
        for (const role of roles) {
            const kind = (0, permissions_1.waiterSystemKind)(role.name);
            if (!kind)
                continue;
            const blocked = (0, permissions_1.waiterBlockedPermissions)(kind);
            const perms = (0, permissions_1.parsePermissions)(role.permissions);
            const next = perms.filter((p) => !blocked.includes(p));
            if (next.length === perms.length)
                continue;
            await db
                .update(db_1.schema.merchantRoles)
                .set({ permissions: (0, permissions_1.encodePermissions)(next), updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, role.id));
        }
    }
    static async listRoles(merchantId) {
        await this.ensureDefaultRoles(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
            orderBy: (0, drizzle_orm_1.asc)(db_1.schema.merchantRoles.sortOrder),
        });
    }
    static async updateRole(merchantId, roleId, updates) {
        const db = (0, db_1.getDb)();
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId)),
        });
        if (!role)
            throw new Error("Role not found");
        const patch = { updatedAt: new Date() };
        if (updates.name !== undefined) {
            const name = String(updates.name || "").trim().slice(0, 100);
            if (!name)
                throw new Error("Role name is required");
            patch.name = name;
        }
        if (updates.permissions !== undefined) {
            patch.permissions = (0, permissions_1.encodePermissions)(updates.permissions);
        }
        const [row] = await db
            .update(db_1.schema.merchantRoles)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId))
            .returning();
        await this.enforceWaiterFloorRestrictions(merchantId);
        return ((await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId),
        })) || row);
    }
    static async createRole(merchantId, name, permissions) {
        const db = (0, db_1.getDb)();
        const trimmed = name.trim().slice(0, 100);
        if (!trimmed)
            throw new Error("Role name is required");
        const [row] = await db
            .insert(db_1.schema.merchantRoles)
            .values({
            merchantId,
            name: trimmed,
            permissions: (0, permissions_1.encodePermissions)(permissions),
            isSystem: false,
            sortOrder: 100,
        })
            .returning();
        return row;
    }
    static async deleteRole(merchantId, roleId) {
        const db = (0, db_1.getDb)();
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId)),
        });
        if (!role)
            throw new Error("Role not found");
        if (role.isSystem)
            throw new Error("System roles cannot be deleted");
        const inUse = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.roleId, roleId),
        });
        if (inUse)
            throw new Error("Role is assigned to staff members");
        await db.delete(db_1.schema.merchantRoles).where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId));
    }
    static async listStaff(merchantId) {
        await this.ensureDefaultRoles(merchantId);
        const db = (0, db_1.getDb)();
        const staff = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
            orderBy: (0, drizzle_orm_1.asc)(db_1.schema.merchantStaff.name),
        });
        const roles = await this.listRoles(merchantId);
        const roleMap = new Map(roles.map((r) => [r.id, r]));
        return staff.map((s) => {
            const role = roleMap.get(s.roleId);
            return {
                id: s.id,
                name: s.name,
                email: s.email,
                roleId: s.roleId,
                roleName: role?.name || "Unknown",
                permissions: (0, permissions_1.parsePermissions)(role?.permissions),
                canAccessPanel: s.canAccessPanel,
                isActive: s.isActive,
                pinSet: !!s.pinHash,
                passwordSet: !!s.passwordHash,
                deliveryHourlyRateOverride: s.deliveryHourlyRateOverride ?? null,
                deliveryPerOrderFeeOverride: s.deliveryPerOrderFeeOverride ?? null,
                createdAt: s.createdAt,
            };
        });
    }
    static async createStaff(merchantId, input) {
        const db = (0, db_1.getDb)();
        const name = input.name.trim().slice(0, 255);
        if (!name)
            throw new Error("Name is required");
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, input.roleId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId)),
        });
        if (!role)
            throw new Error("Invalid role");
        const email = input.email?.trim().toLowerCase() || null;
        if (email) {
            const dup = await db.query.merchantStaff.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.email, email)),
            });
            if (dup)
                throw new Error("Email already used by another staff member");
        }
        const pin = input.pin?.trim();
        if (pin && (pin.length < 4 || pin.length > 8)) {
            throw new Error("PIN must be 4-8 digits");
        }
        if (pin)
            await this.assertPinUnique(merchantId, pin);
        const password = input.password?.trim() || "";
        // Email + password on create always enables official /login (do not require a checkbox).
        const canAccessPanel = !!input.canAccessPanel || !!(email && password);
        if (canAccessPanel && !email) {
            throw new Error("Email is required for panel access");
        }
        if (canAccessPanel && !password) {
            throw new Error("Password is required for panel access");
        }
        const { MerchantEntitlementsService } = await Promise.resolve().then(() => __importStar(require("@/services/merchant-entitlements.service")));
        await MerchantEntitlementsService.assertCanAddStaff(merchantId, 1);
        const [row] = await db
            .insert(db_1.schema.merchantStaff)
            .values({
            merchantId,
            roleId: input.roleId,
            name,
            email,
            pinHash: pin ? await auth_service_1.AuthService.hashPassword(pin) : null,
            passwordHash: password ? await auth_service_1.AuthService.hashPassword(password) : null,
            canAccessPanel,
            isActive: true,
        })
            .returning();
        return this.formatStaff(row, role);
    }
    static async updateStaff(merchantId, staffId, input) {
        const db = (0, db_1.getDb)();
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)),
        });
        if (!staff)
            throw new Error("Staff member not found");
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined) {
            const name = input.name.trim().slice(0, 255);
            if (!name)
                throw new Error("Name is required");
            patch.name = name;
        }
        if (input.roleId !== undefined) {
            const role = await db.query.merchantRoles.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, input.roleId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId)),
            });
            if (!role)
                throw new Error("Invalid role");
            patch.roleId = input.roleId;
        }
        if (input.email !== undefined) {
            const email = input.email?.trim().toLowerCase() || null;
            if (email) {
                const dup = await db.query.merchantStaff.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.email, email)),
                });
                if (dup && dup.id !== staffId)
                    throw new Error("Email already used");
            }
            patch.email = email;
        }
        if (input.pin !== undefined) {
            if (input.pin === null || input.pin === "") {
                patch.pinHash = null;
            }
            else {
                const pin = String(input.pin).trim();
                if (pin.length < 4 || pin.length > 8)
                    throw new Error("PIN must be 4-8 digits");
                await this.assertPinUnique(merchantId, pin, staffId);
                patch.pinHash = await auth_service_1.AuthService.hashPassword(pin);
            }
        }
        if (input.password !== undefined) {
            if (input.password === null || input.password === "") {
                patch.passwordHash = null;
            }
            else {
                patch.passwordHash = await auth_service_1.AuthService.hashPassword(String(input.password).trim());
            }
        }
        if (input.isActive !== undefined)
            patch.isActive = !!input.isActive;
        if (input.deliveryHourlyRateOverride !== undefined) {
            patch.deliveryHourlyRateOverride =
                input.deliveryHourlyRateOverride == null || input.deliveryHourlyRateOverride === ''
                    ? null
                    : String(Number(input.deliveryHourlyRateOverride));
        }
        if (input.deliveryPerOrderFeeOverride !== undefined) {
            patch.deliveryPerOrderFeeOverride =
                input.deliveryPerOrderFeeOverride == null || input.deliveryPerOrderFeeOverride === ''
                    ? null
                    : String(Number(input.deliveryPerOrderFeeOverride));
        }
        const nextEmail = input.email !== undefined
            ? input.email?.trim().toLowerCase() || null
            : staff.email;
        const settingPassword = input.password !== undefined && !!String(input.password || "").trim();
        // Setting email + a new password enables official /login even if the checkbox was off.
        if (settingPassword && nextEmail) {
            patch.canAccessPanel = true;
        }
        else if (input.canAccessPanel !== undefined) {
            patch.canAccessPanel = !!input.canAccessPanel;
        }
        const nextCanAccess = patch.canAccessPanel !== undefined ? !!patch.canAccessPanel : !!staff.canAccessPanel;
        const nextPasswordHash = input.password !== undefined
            ? input.password === null || input.password === ""
                ? null
                : "set"
            : staff.passwordHash
                ? "set"
                : null;
        if (nextCanAccess) {
            if (!nextEmail)
                throw new Error("Email is required for panel access");
            if (!nextPasswordHash) {
                throw new Error("Password is required for panel access (set a new password)");
            }
        }
        const [row] = await db
            .update(db_1.schema.merchantStaff)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId))
            .returning();
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, row.roleId),
        });
        return this.formatStaff(row, role);
    }
    static async assertPinUnique(merchantId, pin, excludeStaffId) {
        const db = (0, db_1.getDb)();
        const staffList = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
        });
        for (const staff of staffList) {
            if (excludeStaffId && staff.id === excludeStaffId)
                continue;
            if (!staff.pinHash)
                continue;
            const taken = await auth_service_1.AuthService.comparePassword(pin, staff.pinHash);
            if (taken)
                throw new Error("PIN already used by another staff member");
        }
    }
    static async deleteStaff(merchantId, staffId) {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)));
    }
    static async verifyPin(merchantId, pin) {
        const db = (0, db_1.getDb)();
        const normalized = pin.trim();
        if (!normalized)
            throw new Error("PIN is required");
        if (normalized.length < 4 || normalized.length > 8) {
            throw new Error("PIN must be 4-8 digits");
        }
        // Ensure system Waiter privileges stay floor-only before returning PIN session.
        await this.enforceWaiterFloorRestrictions(merchantId);
        const staffList = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
        });
        const matches = [];
        for (const staff of staffList) {
            if (!staff.pinHash)
                continue;
            const ok = await auth_service_1.AuthService.comparePassword(normalized, staff.pinHash);
            if (ok)
                matches.push(staff);
        }
        if (matches.length > 1) {
            throw new Error("PIN is assigned to multiple users — ask your manager to give each person a unique PIN");
        }
        if (!matches.length)
            throw new Error("Invalid PIN");
        const staff = matches[0];
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, staff.roleId),
        });
        const permissions = (0, permissions_1.parsePermissions)(role?.permissions);
        const accessToken = auth_service_1.AuthService.generateToken({
            id: staff.id,
            email: staff.email || `${staff.id}@pin.local`,
            role: "staff",
            merchantId,
            staffId: staff.id,
            name: staff.name,
            roleName: role?.name || "Staff",
            permissions,
        });
        return {
            id: staff.id,
            name: staff.name,
            roleId: staff.roleId,
            roleName: role?.name || "Staff",
            permissions,
            preferredTerminalId: staff.preferredTerminalId || null,
            accessToken,
            /** Android PosPermission-compatible keys for clients that consume this payload. */
            androidPermissions: (0, permissions_1.toAndroidPermissions)(permissions),
        };
    }
    /** Fresh staff profile for session refresh (panel / WebPOS after role change). */
    static async getStaffProfile(merchantId, staffId) {
        const db = (0, db_1.getDb)();
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
        });
        if (!staff)
            throw new Error("Staff member not found");
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, staff.roleId),
        });
        const permissions = (0, permissions_1.parsePermissions)(role?.permissions);
        return {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            roleId: staff.roleId,
            roleName: role?.name || "Staff",
            permissions,
            canAccessPanel: staff.canAccessPanel,
            preferredTerminalId: staff.preferredTerminalId || null,
        };
    }
    /** Waiter / cashier saves their preferred payment terminal for WebPOS. */
    static async updatePosPreferences(merchantId, staffId, prefs) {
        const db = (0, db_1.getDb)();
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
        });
        if (!staff)
            throw new Error("Staff member not found");
        let terminalId = null;
        if (prefs.preferredTerminalId != null && String(prefs.preferredTerminalId).trim()) {
            terminalId = String(prefs.preferredTerminalId).trim();
            const terminal = await db.query.paymentTerminals.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.terminalId, terminalId)),
            });
            if (!terminal)
                throw new Error("Terminal not found");
        }
        await db
            .update(db_1.schema.merchantStaff)
            .set({ preferredTerminalId: terminalId, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId));
        return { preferredTerminalId: terminalId };
    }
    static async loginStaff(email, password) {
        const db = (0, db_1.getDb)();
        const normalized = email.trim().toLowerCase();
        const rows = await db
            .select()
            .from(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchantStaff.email}) = ${normalized}`, (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)))
            .limit(1);
        const staff = rows[0];
        if (!staff) {
            throw new Error("Invalid email or password");
        }
        if (!staff.passwordHash) {
            throw new Error(staff.pinHash ? this.PIN_ONLY_LOGIN_MESSAGE : this.NO_PASSWORD_LOGIN_MESSAGE);
        }
        const ok = await auth_service_1.AuthService.comparePassword(password, staff.passwordHash);
        if (!ok)
            throw new Error("Invalid email or password");
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, staff.roleId),
        });
        const permissions = (0, permissions_1.parsePermissions)(role?.permissions);
        if (!(0, permissions_1.hasAnyPermission)(permissions, permissions_1.STAFF_MERCHANT_ENTRY_PERMISSIONS)) {
            throw new Error(this.NO_ENTRY_PERMISSION_MESSAGE);
        }
        return {
            staff,
            role,
            permissions,
        };
    }
    static async getSyncPayload(merchantId) {
        await this.ensureDefaultRoles(merchantId);
        const roles = await this.listRoles(merchantId);
        const staff = await dbStaffForSync(merchantId);
        return {
            roles: roles.map((r) => ({
                id: r.id,
                name: r.name,
                permissions: (0, permissions_1.toAndroidPermissions)((0, permissions_1.parsePermissions)(r.permissions)),
                isSystem: r.isSystem,
            })),
            staff: staff.map((s) => ({
                id: s.id,
                name: s.name,
                roleId: s.roleId,
                pinHash: s.pinHash,
                isActive: s.isActive,
            })),
        };
    }
    static formatStaff(staff, role) {
        return {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            roleId: staff.roleId,
            roleName: role.name,
            permissions: (0, permissions_1.parsePermissions)(role.permissions),
            canAccessPanel: staff.canAccessPanel,
            isActive: staff.isActive,
            pinSet: !!staff.pinHash,
            passwordSet: !!staff.passwordHash,
        };
    }
}
exports.StaffService = StaffService;
/** Staff row exists with a POS PIN but no email/password hash for /login. */
StaffService.PIN_ONLY_LOGIN_MESSAGE = "This account uses a POS PIN. Sign in on the POS with your PIN, or ask the owner to set an official login password in Users & roles.";
/** Staff email exists but password was never hashed (must be set again). */
StaffService.NO_PASSWORD_LOGIN_MESSAGE = "This staff account has no official login password. Ask the owner to set one in Users & roles.";
StaffService.NO_ENTRY_PERMISSION_MESSAGE = "This account cannot sign in";
async function dbStaffForSync(merchantId) {
    const db = (0, db_1.getDb)();
    return db.query.merchantStaff.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
    });
}
//# sourceMappingURL=staff.service.js.map