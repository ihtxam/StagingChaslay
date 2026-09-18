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
exports.ALL_PERMISSIONS = exports.StaffService = exports.DEFAULT_MANAGER_PIN = void 0;
exports.invalidateDefaultRolesCache = invalidateDefaultRolesCache;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const auth_service_1 = require("@/services/auth.service");
const permissions_1 = require("@/lib/permissions");
Object.defineProperty(exports, "ALL_PERMISSIONS", { enumerable: true, get: function () { return permissions_1.ALL_PERMISSIONS; } });
const staff_login_home_1 = require("@/lib/staff-login-home");
/** Skip expensive role seeding/enforcement on every staff list (once per process per merchant). */
const defaultRolesReady = new Set();
/** Default POS PIN for the first manager provisioned on new merchant signup. Change in Users & roles. */
exports.DEFAULT_MANAGER_PIN = "0000";
function invalidateDefaultRolesCache(merchantId) {
    defaultRolesReady.delete(merchantId);
}
class StaffService {
    static isLoginGuidanceError(message) {
        return (message === this.PIN_ONLY_LOGIN_MESSAGE ||
            message === this.NO_PASSWORD_LOGIN_MESSAGE ||
            message === this.NO_ENTRY_PERMISSION_MESSAGE);
    }
    static async ensureDefaultRoles(merchantId) {
        const db = (0, db_1.getDb)();
        if (defaultRolesReady.has(merchantId)) {
            return db.query.merchantRoles.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
            });
        }
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
        await this.ensureStorekeeperSystemRole(merchantId);
        await this.removeGandolaSystemRole(merchantId);
        // Existing Manager roles that already see company reports keep VIEW_ALL_SALES.
        await this.ensureManagerViewAllSales(merchantId);
        await this.ensureManagerGandolaPurge(merchantId);
        // Waiters: keep merchant-saved permissions; only align POS login home.
        await this.enforceWaiterFloorRestrictions(merchantId);
        await this.enforceStorekeeperPanelRestrictions(merchantId);
        await this.ensureCashierRolePermissions(merchantId);
        await this.syncCashierLoginHome(merchantId);
        defaultRolesReady.add(merchantId);
        return db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
    }
    /**
     * Provision the merchant's first Manager staff row (POS PIN + full panel role).
     * Idempotent: skips when any staff already exist.
     * Default PIN is 0000 (stored for display in Users & roles).
     */
    static async ensureDefaultManagerStaff(merchantId, displayName) {
        const db = (0, db_1.getDb)();
        await this.ensureDefaultRoles(merchantId);
        const existingStaff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
            columns: { id: true },
        });
        if (existingStaff)
            return null;
        const managerRole = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.sql) `lower(trim(${db_1.schema.merchantRoles.name})) = 'manager'`),
        });
        if (!managerRole) {
            console.warn(`[staff] Manager role missing for merchant ${merchantId}`);
            return null;
        }
        const name = "Manager";
        try {
            return await this.createStaff(merchantId, {
                name,
                roleId: managerRole.id,
                pin: exports.DEFAULT_MANAGER_PIN,
                loginHome: "panel",
            });
        }
        catch (error) {
            console.warn(`[staff] Default manager provisioning failed for merchant ${merchantId}:`, error instanceof Error ? error.message : error);
            return null;
        }
    }
    /**
     * Ensure a Manager staff row exists and has the default POS PIN (0000) when unset.
     * Repairs older merchants that had staff before auto-provisioning existed.
     */
    static async ensureManagerPosPin(merchantId) {
        await this.ensureDefaultRoles(merchantId);
        const db = (0, db_1.getDb)();
        const managerRole = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.sql) `lower(trim(${db_1.schema.merchantRoles.name})) = 'manager'`),
        });
        if (!managerRole)
            return;
        let staffRows = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
        });
        const active = staffRows.filter((s) => s.isActive);
        if (!active.length) {
            await this.ensureDefaultManagerStaff(merchantId, "Manager");
            return;
        }
        let managerStaff = active.find((s) => s.roleId === managerRole.id);
        if (!managerStaff) {
            try {
                await this.createStaff(merchantId, {
                    name: "Manager",
                    roleId: managerRole.id,
                    pin: exports.DEFAULT_MANAGER_PIN,
                    loginHome: "panel",
                });
                staffRows = await db.query.merchantStaff.findMany({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
                });
                managerStaff = staffRows.find((s) => s.isActive && s.roleId === managerRole.id);
            }
            catch {
                /* staff limit — only repair if the shop has no PINs at all */
                if (active.some((s) => s.pinHash))
                    return;
                managerStaff = active.length === 1 ? active[0] : undefined;
            }
        }
        if (!managerStaff)
            return;
        const hasDefaultPin = !!managerStaff.pinHash &&
            (await auth_service_1.AuthService.comparePassword(exports.DEFAULT_MANAGER_PIN, managerStaff.pinHash));
        if (hasDefaultPin) {
            if (managerStaff.pinDisplay !== exports.DEFAULT_MANAGER_PIN) {
                await db
                    .update(db_1.schema.merchantStaff)
                    .set({ pinDisplay: exports.DEFAULT_MANAGER_PIN, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, managerStaff.id));
            }
            return;
        }
        const shouldRepairPin = !managerStaff.pinHash ||
            managerStaff.pinDisplay === exports.DEFAULT_MANAGER_PIN ||
            !active.some((s) => s.pinHash);
        if (!shouldRepairPin)
            return;
        try {
            await this.assignStaffPin(merchantId, managerStaff.id, exports.DEFAULT_MANAGER_PIN);
        }
        catch (error) {
            console.warn(`[staff] Default manager PIN repair failed for merchant ${merchantId}:`, error instanceof Error ? error.message : error);
        }
    }
    static normalizePinInput(pin) {
        return String(pin ?? "")
            .trim()
            .replace(/\D/g, "");
    }
    static async assignStaffPin(merchantId, staffId, pin) {
        const db = (0, db_1.getDb)();
        await this.assertPinUnique(merchantId, pin, staffId);
        await db
            .update(db_1.schema.merchantStaff)
            .set({
            pinHash: await auth_service_1.AuthService.hashPassword(pin),
            pinDisplay: pin,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)));
    }
    /** Re-seed the Storekeeper system role if it was deleted or stripped. */
    static async ensureStorekeeperSystemRole(merchantId) {
        const db = (0, db_1.getDb)();
        const template = permissions_1.DEFAULT_ROLE_TEMPLATES.find((t) => t.name.trim().toLowerCase() === "storekeeper");
        if (!template)
            return;
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const existing = roles.find((r) => r.name.trim().toLowerCase() === "storekeeper");
        if (!existing) {
            await db.insert(db_1.schema.merchantRoles).values({
                merchantId,
                name: template.name,
                permissions: (0, permissions_1.encodePermissions)(template.permissions),
                isSystem: template.isSystem,
                sortOrder: template.sortOrder,
            });
            return;
        }
        const perms = (0, permissions_1.parsePermissions)(existing.permissions);
        const expected = (0, permissions_1.encodePermissions)(template.permissions);
        if (!existing.isSystem ||
            existing.sortOrder !== template.sortOrder ||
            existing.permissions !== expected) {
            await db
                .update(db_1.schema.merchantRoles)
                .set({
                name: template.name,
                permissions: expected,
                isSystem: true,
                sortOrder: template.sortOrder,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, existing.id));
        }
    }
    /** Remove deprecated gandola system role; reassign staff to Manager when possible. */
    static async removeGandolaSystemRole(merchantId) {
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const gandola = roles.find((r) => r.name.trim().toLowerCase() === "gandola");
        if (!gandola)
            return;
        const manager = roles.find((r) => r.name.trim().toLowerCase() === "manager");
        if (manager) {
            await db
                .update(db_1.schema.merchantStaff)
                .set({ roleId: manager.id, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.roleId, gandola.id)));
        }
        await db.delete(db_1.schema.merchantRoles).where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, gandola.id));
    }
    /** Grant GANDOLA_PURGE to system Manager roles (cash order purge via search 5× tap). */
    static async ensureManagerGandolaPurge(merchantId) {
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.isSystem, true)),
        });
        for (const role of roles) {
            if (!role.name.trim().toLowerCase().startsWith("manager"))
                continue;
            const perms = (0, permissions_1.parsePermissions)(role.permissions);
            if (perms.includes("GANDOLA_PURGE"))
                continue;
            await db
                .update(db_1.schema.merchantRoles)
                .set({
                permissions: (0, permissions_1.encodePermissions)([...perms, "GANDOLA_PURGE"]),
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, role.id));
        }
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
     * Align floor-waiter login home. Do not rewrite role permissions — merchants
     * can grant extra access on Users & roles and those checkboxes must persist.
     */
    static async enforceWaiterFloorRestrictions(merchantId) {
        await this.syncFloorWaiterLoginHome(merchantId);
    }
    /** Floor waiters should land on POS/waiter screen, not merchant panel. */
    static async syncFloorWaiterLoginHome(merchantId) {
        const db = (0, db_1.getDb)();
        const staffRows = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
        });
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const roleById = new Map(roles.map((r) => [r.id, r]));
        for (const member of staffRows) {
            const role = roleById.get(member.roleId);
            if (!role || (0, permissions_1.waiterSystemKind)(role.name) !== "pos-only")
                continue;
            if ((0, staff_login_home_1.normalizeStaffLoginHome)(member.loginHome) === "pos")
                continue;
            await db
                .update(db_1.schema.merchantStaff)
                .set({ loginHome: "pos", updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, member.id));
        }
    }
    /** Storekeeper staff should use the mobile intake app, not the merchant panel. */
    static async syncStorekeeperLoginHome(merchantId) {
        const db = (0, db_1.getDb)();
        const staffRows = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
        });
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const roleById = new Map(roles.map((r) => [r.id, r]));
        for (const member of staffRows) {
            const role = roleById.get(member.roleId);
            if (!role || role.name.trim().toLowerCase() !== "storekeeper")
                continue;
            if ((0, staff_login_home_1.normalizeStaffLoginHome)(member.loginHome) === "pos")
                continue;
            await db
                .update(db_1.schema.merchantStaff)
                .set({ loginHome: "pos", updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, member.id));
        }
    }
    /** Cashiers and other register-first staff should land on WebPOS after email login. */
    static async syncCashierLoginHome(merchantId) {
        const db = (0, db_1.getDb)();
        const staffRows = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
        });
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const roleById = new Map(roles.map((r) => [r.id, r]));
        for (const member of staffRows) {
            const role = roleById.get(member.roleId);
            if (!role)
                continue;
            const perms = (0, permissions_1.applyRolePermissionPolicy)(role.name, (0, permissions_1.parsePermissions)(role.permissions));
            const isCashierRole = role.name.trim().toLowerCase() === "cashier";
            const hasPos = perms.includes("USE_WEBPOS") || perms.includes("MANAGE_TABLES");
            const hasBackend = perms.includes("ACCESS_PANEL") ||
                perms.includes("MANAGE_PRODUCTS") ||
                perms.includes("MANAGE_INVENTORY");
            if (!isCashierRole && !(hasPos && !hasBackend))
                continue;
            if ((0, staff_login_home_1.normalizeStaffLoginHome)(member.loginHome) === "pos")
                continue;
            await db
                .update(db_1.schema.merchantStaff)
                .set({ loginHome: "pos", updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, member.id));
        }
    }
    /** Restore Cashier system role permissions (USE_WEBPOS, etc.) if stripped in older installs. */
    static async ensureCashierRolePermissions(merchantId) {
        const template = permissions_1.DEFAULT_ROLE_TEMPLATES.find((t) => t.name.trim().toLowerCase() === "cashier");
        if (!template)
            return;
        const db = (0, db_1.getDb)();
        const role = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.sql) `lower(trim(${db_1.schema.merchantRoles.name})) = 'cashier'`),
        });
        if (!role)
            return;
        const expected = (0, permissions_1.encodePermissions)(template.permissions);
        if (role.permissions === expected)
            return;
        await db
            .update(db_1.schema.merchantRoles)
            .set({ permissions: expected, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, role.id));
    }
    /**
     * Strip full panel access from the system Storekeeper role.
     * Mobile intake only — inventory managers should use a different role.
     */
    static async enforceStorekeeperPanelRestrictions(merchantId) {
        await this.ensureStorekeeperSystemRole(merchantId);
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.isSystem, true)),
        });
        const template = permissions_1.DEFAULT_ROLE_TEMPLATES.find((t) => t.name.trim().toLowerCase() === "storekeeper");
        const expected = template ? (0, permissions_1.encodePermissions)(template.permissions) : (0, permissions_1.encodePermissions)(["STOREKEEPER_INTAKE"]);
        for (const role of roles) {
            if (role.name.trim().toLowerCase() !== "storekeeper")
                continue;
            if (role.permissions !== expected) {
                await db
                    .update(db_1.schema.merchantRoles)
                    .set({ permissions: expected, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, role.id));
            }
        }
        await this.syncStorekeeperLoginHome(merchantId);
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
        invalidateDefaultRolesCache(merchantId);
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
            patch.permissions = (0, permissions_1.encodePermissions)((0, permissions_1.normalizePermissions)(updates.permissions));
        }
        const [row] = await db
            .update(db_1.schema.merchantRoles)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId))
            .returning();
        await this.enforceWaiterFloorRestrictions(merchantId);
        await this.enforceStorekeeperPanelRestrictions(merchantId);
        return ((await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, roleId),
        })) || row);
    }
    static async createRole(merchantId, name, permissions) {
        invalidateDefaultRolesCache(merchantId);
        const db = (0, db_1.getDb)();
        const trimmed = name.trim().slice(0, 100);
        if (!trimmed)
            throw new Error("Role name is required");
        const [row] = await db
            .insert(db_1.schema.merchantRoles)
            .values({
            merchantId,
            name: trimmed,
            permissions: (0, permissions_1.encodePermissions)((0, permissions_1.normalizePermissions)(permissions)),
            isSystem: false,
            sortOrder: 100,
        })
            .returning();
        return row;
    }
    static async deleteRole(merchantId, roleId) {
        invalidateDefaultRolesCache(merchantId);
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
    /** Re-create the default manager when a merchant has zero staff (recovery after accidental deletes). */
    static async ensureMerchantHasStaff(merchantId) {
        const db = (0, db_1.getDb)();
        const existingStaff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId),
            columns: { id: true },
        });
        if (!existingStaff) {
            await this.ensureDefaultManagerStaff(merchantId, "Manager");
        }
        await this.ensureManagerPosPin(merchantId);
    }
    static async listStaff(merchantId) {
        const db = (0, db_1.getDb)();
        await this.ensureMerchantHasStaff(merchantId);
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
                permissions: (0, permissions_1.applyRolePermissionPolicy)(role?.name || "Unknown", (0, permissions_1.parsePermissions)(role?.permissions)),
                canAccessPanel: s.canAccessPanel,
                isActive: s.isActive,
                pinSet: !!s.pinHash,
                pin: s.pinDisplay || null,
                passwordSet: !!s.passwordHash,
                deliveryHourlyRateOverride: s.deliveryHourlyRateOverride ?? null,
                deliveryPerOrderFeeOverride: s.deliveryPerOrderFeeOverride ?? null,
                loginHome: (0, staff_login_home_1.normalizeStaffLoginHome)(s.loginHome),
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
        const permissions = (0, permissions_1.parsePermissions)(role.permissions);
        const loginHome = input.loginHome !== undefined
            ? (0, staff_login_home_1.normalizeStaffLoginHome)(input.loginHome)
            : (0, staff_login_home_1.loginHomeFromPermissions)(permissions, canAccessPanel);
        (0, staff_login_home_1.assertLoginHomeAllowed)(loginHome, permissions, canAccessPanel);
        const [row] = await db
            .insert(db_1.schema.merchantStaff)
            .values({
            merchantId,
            roleId: input.roleId,
            name,
            email,
            pinHash: pin ? await auth_service_1.AuthService.hashPassword(pin) : null,
            pinDisplay: pin || null,
            passwordHash: password ? await auth_service_1.AuthService.hashPassword(password) : null,
            canAccessPanel,
            loginHome,
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
                patch.pinDisplay = null;
            }
            else {
                const pin = String(input.pin).trim();
                if (pin.length < 4 || pin.length > 8)
                    throw new Error("PIN must be 4-8 digits");
                await this.assertPinUnique(merchantId, pin, staffId);
                patch.pinHash = await auth_service_1.AuthService.hashPassword(pin);
                patch.pinDisplay = pin;
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
        const roleForHome = await db.query.merchantRoles.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.id, patch.roleId || staff.roleId),
        });
        const rolePermissions = (0, permissions_1.parsePermissions)(roleForHome?.permissions);
        const nextCanAccessFinal = patch.canAccessPanel !== undefined ? !!patch.canAccessPanel : !!staff.canAccessPanel;
        if (input.loginHome !== undefined) {
            const loginHome = (0, staff_login_home_1.normalizeStaffLoginHome)(input.loginHome);
            (0, staff_login_home_1.assertLoginHomeAllowed)(loginHome, rolePermissions, nextCanAccessFinal);
            patch.loginHome = loginHome;
        }
        else if (patch.roleId !== undefined) {
            const loginHome = (0, staff_login_home_1.loginHomeFromPermissions)(rolePermissions, nextCanAccessFinal);
            (0, staff_login_home_1.assertLoginHomeAllowed)(loginHome, rolePermissions, nextCanAccessFinal);
            patch.loginHome = loginHome;
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
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)),
            columns: { id: true },
        });
        if (!staff)
            throw new Error("Staff member not found");
        const [{ total }] = await db
            .select({ total: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId));
        if ((total ?? 0) <= 1) {
            throw new Error("Cannot remove the last user. At least one staff account must remain.");
        }
        await db
            .delete(db_1.schema.merchantStaff)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId)));
    }
    static async verifyPin(merchantId, pin) {
        const db = (0, db_1.getDb)();
        await this.ensureManagerPosPin(merchantId);
        const normalized = this.normalizePinInput(pin);
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
        const permissions = (0, permissions_1.applyRolePermissionPolicy)(role?.name || "Staff", (0, permissions_1.parsePermissions)(role?.permissions));
        const accessToken = auth_service_1.AuthService.generateToken({
            id: staff.id,
            email: staff.email || `${staff.id}@pin.local`,
            role: "staff",
            merchantId,
            staffId: staff.id,
            name: staff.name,
            roleName: role?.name || "Staff",
            permissions,
            authEpoch: await auth_service_1.AuthService.getMerchantAuthEpoch(merchantId),
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
        const permissions = (0, permissions_1.applyRolePermissionPolicy)(role?.name || "Staff", (0, permissions_1.parsePermissions)(role?.permissions));
        return {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            roleId: staff.roleId,
            roleName: role?.name || "Staff",
            permissions,
            canAccessPanel: staff.canAccessPanel,
            loginHome: (0, staff_login_home_1.normalizeStaffLoginHome)(staff.loginHome),
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
        const permissions = (0, permissions_1.applyRolePermissionPolicy)(role?.name || "Staff", (0, permissions_1.parsePermissions)(role?.permissions));
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
            permissions: (0, permissions_1.applyRolePermissionPolicy)(role.name, (0, permissions_1.parsePermissions)(role.permissions)),
            canAccessPanel: staff.canAccessPanel,
            isActive: staff.isActive,
            pinSet: !!staff.pinHash,
            pin: staff.pinDisplay || null,
            passwordSet: !!staff.passwordHash,
            loginHome: (0, staff_login_home_1.normalizeStaffLoginHome)(staff.loginHome),
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