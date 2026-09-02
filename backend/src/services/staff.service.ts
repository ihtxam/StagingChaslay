import { getDb, schema } from "@/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { AuthService } from "@/services/auth.service";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_TEMPLATES,
  applyRolePermissionPolicy,
  encodePermissions,
  hasAnyPermission,
  parsePermissions,
  STAFF_MERCHANT_ENTRY_PERMISSIONS,
  toAndroidPermissions,
  waiterBlockedPermissions,
  waiterSystemKind,
  storekeeperBlockedPermissions,
  type Permission,
} from "@/lib/permissions";
import {
  assertLoginHomeAllowed,
  loginHomeFromPermissions,
  normalizeStaffLoginHome,
  type StaffLoginHome,
} from "@/lib/staff-login-home";

/** Skip expensive role seeding/enforcement on every staff list (once per process per merchant). */
const defaultRolesReady = new Set<string>();

/** Default POS PIN for the first manager provisioned on new merchant signup. Change in Users & roles. */
export const DEFAULT_MANAGER_PIN = "0000";

export function invalidateDefaultRolesCache(merchantId: string) {
  defaultRolesReady.delete(merchantId);
}

export class StaffService {
  /** Staff row exists with a POS PIN but no email/password hash for /login. */
  static readonly PIN_ONLY_LOGIN_MESSAGE =
    "This account uses a POS PIN. Sign in on the POS with your PIN, or ask the owner to set an official login password in Users & roles.";
  /** Staff email exists but password was never hashed (must be set again). */
  static readonly NO_PASSWORD_LOGIN_MESSAGE =
    "This staff account has no official login password. Ask the owner to set one in Users & roles.";
  static readonly NO_ENTRY_PERMISSION_MESSAGE = "This account cannot sign in";

  static isLoginGuidanceError(message: string): boolean {
    return (
      message === this.PIN_ONLY_LOGIN_MESSAGE ||
      message === this.NO_PASSWORD_LOGIN_MESSAGE ||
      message === this.NO_ENTRY_PERMISSION_MESSAGE
    );
  }

  static async ensureDefaultRoles(merchantId: string) {
    const db = getDb();
    if (defaultRolesReady.has(merchantId)) {
      return db.query.merchantRoles.findMany({
        where: eq(schema.merchantRoles.merchantId, merchantId),
      });
    }
    const existing = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    if (existing.length === 0) {
      await db.insert(schema.merchantRoles).values(
        DEFAULT_ROLE_TEMPLATES.map((t) => ({
          merchantId,
          name: t.name,
          permissions: encodePermissions(t.permissions),
          isSystem: t.isSystem,
          sortOrder: t.sortOrder,
        }))
      );
    } else {
      const have = new Set(existing.map((r) => r.name.trim().toLowerCase()));
      const missing = DEFAULT_ROLE_TEMPLATES.filter((t) => !have.has(t.name.trim().toLowerCase()));
      if (missing.length) {
        await db.insert(schema.merchantRoles).values(
          missing.map((t) => ({
            merchantId,
            name: t.name,
            permissions: encodePermissions(t.permissions),
            isSystem: t.isSystem,
            sortOrder: t.sortOrder,
          }))
        );
      }
    }
    await this.ensureStorekeeperSystemRole(merchantId);
    // Existing Manager roles that already see company reports keep VIEW_ALL_SALES.
    await this.ensureManagerViewAllSales(merchantId);
    // Waiters: never panel / drawer / company sales. Menu + orders stay role-assigned.
    await this.enforceWaiterFloorRestrictions(merchantId);
    await this.enforceStorekeeperPanelRestrictions(merchantId);
    defaultRolesReady.add(merchantId);
    return db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
  }

  /**
   * Provision the merchant's first Manager staff row (POS PIN + full panel role).
   * Idempotent: skips when any staff already exist.
   * Default PIN is 0000 (stored for display in Users & roles).
   */
  static async ensureDefaultManagerStaff(merchantId: string, displayName: string) {
    const db = getDb();
    await this.ensureDefaultRoles(merchantId);

    const existingStaff = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.merchantId, merchantId),
      columns: { id: true },
    });
    if (existingStaff) return null;

    const managerRole = await db.query.merchantRoles.findFirst({
      where: and(
        eq(schema.merchantRoles.merchantId, merchantId),
        sql`lower(trim(${schema.merchantRoles.name})) = 'manager'`
      ),
    });
    if (!managerRole) {
      console.warn(`[staff] Manager role missing for merchant ${merchantId}`);
      return null;
    }

    const name = String(displayName || "").trim().slice(0, 255) || "Manager";
    try {
      return await this.createStaff(merchantId, {
        name,
        roleId: managerRole.id,
        pin: DEFAULT_MANAGER_PIN,
        loginHome: "panel",
      });
    } catch (error) {
      console.warn(
        `[staff] Default manager provisioning failed for merchant ${merchantId}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /** Re-seed the Storekeeper system role if it was deleted or stripped. */
  static async ensureStorekeeperSystemRole(merchantId: string) {
    const db = getDb();
    const template = DEFAULT_ROLE_TEMPLATES.find((t) => t.name.trim().toLowerCase() === "storekeeper");
    if (!template) return;
    const roles = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    const existing = roles.find((r) => r.name.trim().toLowerCase() === "storekeeper");
    if (!existing) {
      await db.insert(schema.merchantRoles).values({
        merchantId,
        name: template.name,
        permissions: encodePermissions(template.permissions),
        isSystem: template.isSystem,
        sortOrder: template.sortOrder,
      });
      return;
    }
    const perms = parsePermissions(existing.permissions);
    const expected = encodePermissions(template.permissions);
    if (
      !existing.isSystem ||
      existing.sortOrder !== template.sortOrder ||
      existing.permissions !== expected
    ) {
      await db
        .update(schema.merchantRoles)
        .set({
          name: template.name,
          permissions: expected,
          isSystem: true,
          sortOrder: template.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(schema.merchantRoles.id, existing.id));
    }
  }

  /** Grant VIEW_ALL_SALES to system Manager roles that already have company report access. */
  static async ensureManagerViewAllSales(merchantId: string) {
    const db = getDb();
    const roles = await db.query.merchantRoles.findMany({
      where: and(eq(schema.merchantRoles.merchantId, merchantId), eq(schema.merchantRoles.isSystem, true)),
    });
    for (const role of roles) {
      if (!role.name.trim().toLowerCase().startsWith("manager")) continue;
      const perms = parsePermissions(role.permissions);
      if (perms.includes("VIEW_ALL_SALES")) continue;
      if (!perms.includes("VIEW_REPORTS") && !perms.includes("END_OF_DAY")) continue;
      await db
        .update(schema.merchantRoles)
        .set({
          permissions: encodePermissions([...perms, "VIEW_ALL_SALES"]),
          updatedAt: new Date(),
        })
        .where(eq(schema.merchantRoles.id, role.id));
    }
  }

  /** @deprecated use enforceWaiterFloorRestrictions */
  static async enforceWaiterReportRestrictions(merchantId: string) {
    return this.enforceWaiterFloorRestrictions(merchantId);
  }

  /**
   * Strip full panel / company sales from system Waiter templates.
   * Menu, orders, and own-sales EOD (END_OF_DAY) stay as assigned on the Roles page.
   */
  static async enforceWaiterFloorRestrictions(merchantId: string) {
    const db = getDb();
    const roles = await db.query.merchantRoles.findMany({
      where: and(eq(schema.merchantRoles.merchantId, merchantId), eq(schema.merchantRoles.isSystem, true)),
    });
    for (const role of roles) {
      const kind = waiterSystemKind(role.name);
      if (!kind) continue;
      const blocked = waiterBlockedPermissions(kind);
      const perms = parsePermissions(role.permissions);
      const next = perms.filter((p) => !blocked.includes(p));
      if (next.length === perms.length) continue;
      await db
        .update(schema.merchantRoles)
        .set({ permissions: encodePermissions(next), updatedAt: new Date() })
        .where(eq(schema.merchantRoles.id, role.id));
    }
    await this.syncFloorWaiterLoginHome(merchantId);
  }

  /** Floor waiters should land on POS/waiter screen, not merchant panel. */
  static async syncFloorWaiterLoginHome(merchantId: string) {
    const db = getDb();
    const staffRows = await db.query.merchantStaff.findMany({
      where: eq(schema.merchantStaff.merchantId, merchantId),
    });
    const roles = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    const roleById = new Map(roles.map((r) => [r.id, r]));
    for (const member of staffRows) {
      const role = roleById.get(member.roleId);
      if (!role || waiterSystemKind(role.name) !== "pos-only") continue;
      if (normalizeStaffLoginHome(member.loginHome) === "pos") continue;
      await db
        .update(schema.merchantStaff)
        .set({ loginHome: "pos", updatedAt: new Date() })
        .where(eq(schema.merchantStaff.id, member.id));
    }
  }

  /** Storekeeper staff should use the mobile intake app, not the merchant panel. */
  static async syncStorekeeperLoginHome(merchantId: string) {
    const db = getDb();
    const staffRows = await db.query.merchantStaff.findMany({
      where: eq(schema.merchantStaff.merchantId, merchantId),
    });
    const roles = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    const roleById = new Map(roles.map((r) => [r.id, r]));
    for (const member of staffRows) {
      const role = roleById.get(member.roleId);
      if (!role || role.name.trim().toLowerCase() !== "storekeeper") continue;
      if (normalizeStaffLoginHome(member.loginHome) === "pos") continue;
      await db
        .update(schema.merchantStaff)
        .set({ loginHome: "pos", updatedAt: new Date() })
        .where(eq(schema.merchantStaff.id, member.id));
    }
  }

  /**
   * Strip full panel access from the system Storekeeper role.
   * Mobile intake only — inventory managers should use a different role.
   */
  static async enforceStorekeeperPanelRestrictions(merchantId: string) {
    await this.ensureStorekeeperSystemRole(merchantId);
    const db = getDb();
    const roles = await db.query.merchantRoles.findMany({
      where: and(eq(schema.merchantRoles.merchantId, merchantId), eq(schema.merchantRoles.isSystem, true)),
    });
    const template = DEFAULT_ROLE_TEMPLATES.find((t) => t.name.trim().toLowerCase() === "storekeeper");
    const expected = template ? encodePermissions(template.permissions) : encodePermissions(["STOREKEEPER_INTAKE"]);
    for (const role of roles) {
      if (role.name.trim().toLowerCase() !== "storekeeper") continue;
      if (role.permissions !== expected) {
        await db
          .update(schema.merchantRoles)
          .set({ permissions: expected, updatedAt: new Date() })
          .where(eq(schema.merchantRoles.id, role.id));
      }
    }
    await this.syncStorekeeperLoginHome(merchantId);
  }

  static async listRoles(merchantId: string) {
    await this.ensureDefaultRoles(merchantId);
    const db = getDb();
    return db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
      orderBy: asc(schema.merchantRoles.sortOrder),
    });
  }

  static async updateRole(
    merchantId: string,
    roleId: string,
    updates: { name?: string; permissions?: Permission[] }
  ) {
    invalidateDefaultRolesCache(merchantId);
    const db = getDb();
    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Role not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim().slice(0, 100);
      if (!name) throw new Error("Role name is required");
      patch.name = name;
    }
    if (updates.permissions !== undefined) {
      patch.permissions = encodePermissions(updates.permissions);
    }

    const [row] = await db
      .update(schema.merchantRoles)
      .set(patch)
      .where(eq(schema.merchantRoles.id, roleId))
      .returning();
    await this.enforceWaiterFloorRestrictions(merchantId);
    await this.enforceStorekeeperPanelRestrictions(merchantId);
    return (
      (await db.query.merchantRoles.findFirst({
        where: eq(schema.merchantRoles.id, roleId),
      })) || row
    );
  }

  static async createRole(merchantId: string, name: string, permissions: Permission[]) {
    invalidateDefaultRolesCache(merchantId);
    const db = getDb();
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) throw new Error("Role name is required");

    const [row] = await db
      .insert(schema.merchantRoles)
      .values({
        merchantId,
        name: trimmed,
        permissions: encodePermissions(permissions),
        isSystem: false,
        sortOrder: 100,
      })
      .returning();
    return row;
  }

  static async deleteRole(merchantId: string, roleId: string) {
    invalidateDefaultRolesCache(merchantId);
    const db = getDb();
    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Role not found");
    if (role.isSystem) throw new Error("System roles cannot be deleted");

    const inUse = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.roleId, roleId),
    });
    if (inUse) throw new Error("Role is assigned to staff members");

    await db.delete(schema.merchantRoles).where(eq(schema.merchantRoles.id, roleId));
  }

  /** Re-create the default manager when a merchant has zero staff (recovery after accidental deletes). */
  static async ensureMerchantHasStaff(merchantId: string) {
    const db = getDb();
    const existingStaff = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.merchantId, merchantId),
      columns: { id: true },
    });
    if (existingStaff) return;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true },
    });
    await this.ensureDefaultManagerStaff(merchantId, merchant?.name || "Manager");
  }

  static async listStaff(merchantId: string) {
    const db = getDb();
    await this.ensureMerchantHasStaff(merchantId);
    const staff = await db.query.merchantStaff.findMany({
      where: eq(schema.merchantStaff.merchantId, merchantId),
      orderBy: asc(schema.merchantStaff.name),
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
        permissions: applyRolePermissionPolicy(role?.name || "Unknown", parsePermissions(role?.permissions)),
        canAccessPanel: s.canAccessPanel,
        isActive: s.isActive,
        pinSet: !!s.pinHash,
        pin: s.pinDisplay || null,
        passwordSet: !!s.passwordHash,
        deliveryHourlyRateOverride: s.deliveryHourlyRateOverride ?? null,
        deliveryPerOrderFeeOverride: s.deliveryPerOrderFeeOverride ?? null,
        loginHome: normalizeStaffLoginHome(s.loginHome),
        createdAt: s.createdAt,
      };
    });
  }

  static async createStaff(
    merchantId: string,
    input: {
      name: string;
      roleId: string;
      pin?: string;
      email?: string;
      password?: string;
      canAccessPanel?: boolean;
      loginHome?: StaffLoginHome;
    }
  ) {
    const db = getDb();
    const name = input.name.trim().slice(0, 255);
    if (!name) throw new Error("Name is required");

    const role = await db.query.merchantRoles.findFirst({
      where: and(eq(schema.merchantRoles.id, input.roleId), eq(schema.merchantRoles.merchantId, merchantId)),
    });
    if (!role) throw new Error("Invalid role");

    const email = input.email?.trim().toLowerCase() || null;
    if (email) {
      const dup = await db.query.merchantStaff.findFirst({
        where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.email, email)),
      });
      if (dup) throw new Error("Email already used by another staff member");
    }

    const pin = input.pin?.trim();
    if (pin && (pin.length < 4 || pin.length > 8)) {
      throw new Error("PIN must be 4-8 digits");
    }
    if (pin) await this.assertPinUnique(merchantId, pin);

    const password = input.password?.trim() || "";
    // Email + password on create always enables official /login (do not require a checkbox).
    const canAccessPanel = !!input.canAccessPanel || !!(email && password);
    if (canAccessPanel && !email) {
      throw new Error("Email is required for panel access");
    }
    if (canAccessPanel && !password) {
      throw new Error("Password is required for panel access");
    }

    const { MerchantEntitlementsService } = await import(
      "@/services/merchant-entitlements.service"
    );
    await MerchantEntitlementsService.assertCanAddStaff(merchantId, 1);

    const permissions = parsePermissions(role.permissions);
    const loginHome =
      input.loginHome !== undefined
        ? normalizeStaffLoginHome(input.loginHome)
        : loginHomeFromPermissions(permissions, canAccessPanel);
    assertLoginHomeAllowed(loginHome, permissions, canAccessPanel);

    const [row] = await db
      .insert(schema.merchantStaff)
      .values({
        merchantId,
        roleId: input.roleId,
        name,
        email,
        pinHash: pin ? await AuthService.hashPassword(pin) : null,
        pinDisplay: pin || null,
        passwordHash: password ? await AuthService.hashPassword(password) : null,
        canAccessPanel,
        loginHome,
        isActive: true,
      })
      .returning();

    return this.formatStaff(row, role);
  }

  static async updateStaff(
    merchantId: string,
    staffId: string,
    input: {
      name?: string;
      roleId?: string;
      pin?: string | null;
      email?: string | null;
      password?: string | null;
      canAccessPanel?: boolean;
      isActive?: boolean;
      deliveryHourlyRateOverride?: number | null;
      deliveryPerOrderFeeOverride?: number | null;
      loginHome?: StaffLoginHome;
    }
  ) {
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(eq(schema.merchantStaff.id, staffId), eq(schema.merchantStaff.merchantId, merchantId)),
    });
    if (!staff) throw new Error("Staff member not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = input.name.trim().slice(0, 255);
      if (!name) throw new Error("Name is required");
      patch.name = name;
    }
    if (input.roleId !== undefined) {
      const role = await db.query.merchantRoles.findFirst({
        where: and(eq(schema.merchantRoles.id, input.roleId), eq(schema.merchantRoles.merchantId, merchantId)),
      });
      if (!role) throw new Error("Invalid role");
      patch.roleId = input.roleId;
    }
    if (input.email !== undefined) {
      const email = input.email?.trim().toLowerCase() || null;
      if (email) {
        const dup = await db.query.merchantStaff.findFirst({
          where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.email, email)),
        });
        if (dup && dup.id !== staffId) throw new Error("Email already used");
      }
      patch.email = email;
    }
    if (input.pin !== undefined) {
      if (input.pin === null || input.pin === "") {
        patch.pinHash = null;
        patch.pinDisplay = null;
      } else {
        const pin = String(input.pin).trim();
        if (pin.length < 4 || pin.length > 8) throw new Error("PIN must be 4-8 digits");
        await this.assertPinUnique(merchantId, pin, staffId);
        patch.pinHash = await AuthService.hashPassword(pin);
        patch.pinDisplay = pin;
      }
    }
    if (input.password !== undefined) {
      if (input.password === null || input.password === "") {
        patch.passwordHash = null;
      } else {
        patch.passwordHash = await AuthService.hashPassword(String(input.password).trim());
      }
    }
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;

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

    const nextEmail =
      input.email !== undefined
        ? input.email?.trim().toLowerCase() || null
        : staff.email;
    const settingPassword = input.password !== undefined && !!String(input.password || "").trim();
    // Setting email + a new password enables official /login even if the checkbox was off.
    if (settingPassword && nextEmail) {
      patch.canAccessPanel = true;
    } else if (input.canAccessPanel !== undefined) {
      patch.canAccessPanel = !!input.canAccessPanel;
    }

    const nextCanAccess =
      patch.canAccessPanel !== undefined ? !!patch.canAccessPanel : !!staff.canAccessPanel;
    const nextPasswordHash =
      input.password !== undefined
        ? input.password === null || input.password === ""
          ? null
          : "set"
        : staff.passwordHash
          ? "set"
          : null;
    if (nextCanAccess) {
      if (!nextEmail) throw new Error("Email is required for panel access");
      if (!nextPasswordHash) {
        throw new Error("Password is required for panel access (set a new password)");
      }
    }

    const roleForHome = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, (patch.roleId as string) || staff.roleId),
    });
    const rolePermissions = parsePermissions(roleForHome?.permissions);
    const nextCanAccessFinal =
      patch.canAccessPanel !== undefined ? !!patch.canAccessPanel : !!staff.canAccessPanel;

    if (input.loginHome !== undefined) {
      const loginHome = normalizeStaffLoginHome(input.loginHome);
      assertLoginHomeAllowed(loginHome, rolePermissions, nextCanAccessFinal);
      patch.loginHome = loginHome;
    } else if (patch.roleId !== undefined) {
      const loginHome = loginHomeFromPermissions(rolePermissions, nextCanAccessFinal);
      assertLoginHomeAllowed(loginHome, rolePermissions, nextCanAccessFinal);
      patch.loginHome = loginHome;
    }

    const [row] = await db
      .update(schema.merchantStaff)
      .set(patch)
      .where(eq(schema.merchantStaff.id, staffId))
      .returning();

    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, row.roleId),
    });
    return this.formatStaff(row, role!);
  }

  private static async assertPinUnique(merchantId: string, pin: string, excludeStaffId?: string) {
    const db = getDb();
    const staffList = await db.query.merchantStaff.findMany({
      where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true)),
    });
    for (const staff of staffList) {
      if (excludeStaffId && staff.id === excludeStaffId) continue;
      if (!staff.pinHash) continue;
      const taken = await AuthService.comparePassword(pin, staff.pinHash);
      if (taken) throw new Error("PIN already used by another staff member");
    }
  }

  static async deleteStaff(merchantId: string, staffId: string) {
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(eq(schema.merchantStaff.id, staffId), eq(schema.merchantStaff.merchantId, merchantId)),
      columns: { id: true },
    });
    if (!staff) throw new Error("Staff member not found");

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.merchantStaff)
      .where(eq(schema.merchantStaff.merchantId, merchantId));
    if ((total ?? 0) <= 1) {
      throw new Error("Cannot remove the last user. At least one staff account must remain.");
    }

    await db
      .delete(schema.merchantStaff)
      .where(and(eq(schema.merchantStaff.id, staffId), eq(schema.merchantStaff.merchantId, merchantId)));
  }

  static async verifyPin(merchantId: string, pin: string) {
    const db = getDb();
    const normalized = pin.trim();
    if (!normalized) throw new Error("PIN is required");
    if (normalized.length < 4 || normalized.length > 8) {
      throw new Error("PIN must be 4-8 digits");
    }

    // Ensure system Waiter privileges stay floor-only before returning PIN session.
    await this.enforceWaiterFloorRestrictions(merchantId);

    const staffList = await db.query.merchantStaff.findMany({
      where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true)),
    });

    const matches: typeof staffList = [];
    for (const staff of staffList) {
      if (!staff.pinHash) continue;
      const ok = await AuthService.comparePassword(normalized, staff.pinHash);
      if (ok) matches.push(staff);
    }

    if (matches.length > 1) {
      throw new Error("PIN is assigned to multiple users — ask your manager to give each person a unique PIN");
    }
    if (!matches.length) throw new Error("Invalid PIN");

    const staff = matches[0];
    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, staff.roleId),
    });
    const permissions = applyRolePermissionPolicy(
      role?.name || "Staff",
      parsePermissions(role?.permissions)
    );
    const accessToken = AuthService.generateToken({
      id: staff.id,
      email: staff.email || `${staff.id}@pin.local`,
      role: "staff",
      merchantId,
      staffId: staff.id,
      name: staff.name,
      roleName: role?.name || "Staff",
      permissions,
      authEpoch: await AuthService.getMerchantAuthEpoch(merchantId),
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
      androidPermissions: toAndroidPermissions(permissions),
    };
  }

  /** Fresh staff profile for session refresh (panel / WebPOS after role change). */
  static async getStaffProfile(merchantId: string, staffId: string) {
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(
        eq(schema.merchantStaff.id, staffId),
        eq(schema.merchantStaff.merchantId, merchantId),
        eq(schema.merchantStaff.isActive, true)
      ),
    });
    if (!staff) throw new Error("Staff member not found");

    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, staff.roleId),
    });
    const permissions = applyRolePermissionPolicy(
      role?.name || "Staff",
      parsePermissions(role?.permissions)
    );

    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      roleId: staff.roleId,
      roleName: role?.name || "Staff",
      permissions,
      canAccessPanel: staff.canAccessPanel,
      loginHome: normalizeStaffLoginHome(staff.loginHome),
      preferredTerminalId: staff.preferredTerminalId || null,
    };
  }

  /** Waiter / cashier saves their preferred payment terminal for WebPOS. */
  static async updatePosPreferences(
    merchantId: string,
    staffId: string,
    prefs: { preferredTerminalId?: string | null }
  ) {
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(
        eq(schema.merchantStaff.id, staffId),
        eq(schema.merchantStaff.merchantId, merchantId),
        eq(schema.merchantStaff.isActive, true)
      ),
    });
    if (!staff) throw new Error("Staff member not found");

    let terminalId: string | null = null;
    if (prefs.preferredTerminalId != null && String(prefs.preferredTerminalId).trim()) {
      terminalId = String(prefs.preferredTerminalId).trim();
      const terminal = await db.query.paymentTerminals.findFirst({
        where: and(
          eq(schema.paymentTerminals.merchantId, merchantId),
          eq(schema.paymentTerminals.terminalId, terminalId)
        ),
      });
      if (!terminal) throw new Error("Terminal not found");
    }

    await db
      .update(schema.merchantStaff)
      .set({ preferredTerminalId: terminalId, updatedAt: new Date() })
      .where(eq(schema.merchantStaff.id, staffId));

    return { preferredTerminalId: terminalId };
  }

  static async loginStaff(email: string, password: string) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(schema.merchantStaff)
      .where(
        and(
          sql`lower(${schema.merchantStaff.email}) = ${normalized}`,
          eq(schema.merchantStaff.isActive, true)
        )
      )
      .limit(1);
    const staff = rows[0];

    if (!staff) {
      throw new Error("Invalid email or password");
    }

    if (!staff.passwordHash) {
      throw new Error(
        staff.pinHash ? this.PIN_ONLY_LOGIN_MESSAGE : this.NO_PASSWORD_LOGIN_MESSAGE
      );
    }

    const ok = await AuthService.comparePassword(password, staff.passwordHash);
    if (!ok) throw new Error("Invalid email or password");

    const role = await db.query.merchantRoles.findFirst({
      where: eq(schema.merchantRoles.id, staff.roleId),
    });
    const permissions = applyRolePermissionPolicy(
      role?.name || "Staff",
      parsePermissions(role?.permissions)
    );
    if (!hasAnyPermission(permissions, STAFF_MERCHANT_ENTRY_PERMISSIONS)) {
      throw new Error(this.NO_ENTRY_PERMISSION_MESSAGE);
    }

    return {
      staff,
      role,
      permissions,
    };
  }

  static async getSyncPayload(merchantId: string) {
    await this.ensureDefaultRoles(merchantId);
    const roles = await this.listRoles(merchantId);
    const staff = await dbStaffForSync(merchantId);

    return {
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: toAndroidPermissions(parsePermissions(r.permissions)),
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

  private static formatStaff(
    staff: typeof schema.merchantStaff.$inferSelect,
    role: typeof schema.merchantRoles.$inferSelect
  ) {
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      roleId: staff.roleId,
      roleName: role.name,
      permissions: applyRolePermissionPolicy(role.name, parsePermissions(role.permissions)),
      canAccessPanel: staff.canAccessPanel,
      isActive: staff.isActive,
      pinSet: !!staff.pinHash,
      pin: staff.pinDisplay || null,
      passwordSet: !!staff.passwordHash,
      loginHome: normalizeStaffLoginHome(staff.loginHome),
    };
  }
}

async function dbStaffForSync(merchantId: string) {
  const db = getDb();
  return db.query.merchantStaff.findMany({
    where: and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true)),
  });
}

export { ALL_PERMISSIONS };
