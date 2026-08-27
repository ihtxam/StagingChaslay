import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { getDb, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";
import { isInventoryAddonEnabled, readInventoryAddonEnabled } from "@/lib/inventory-addon";
import { isSignageAddonEnabled, readSignageAddon } from "@/lib/signage-addon";
import { isKdsAddonEnabled, readKdsAddonEnabled } from "@/lib/kds-addon";
import { isOdsAddonEnabled, readOdsAddonEnabled } from "@/lib/ods-addon";
import { readStorekeeperAddonEnabled } from "@/lib/storekeeper-addon";
import {
  businessModuleMerchantPatch,
  normalizeBusinessModule,
} from "@/lib/business-module";

export interface JWTPayload {
  id: string;
  email: string;
  role: "superadmin" | "merchant" | "customer" | "staff" | "reseller";
  merchantId?: string;
  customerId?: string;
  staffId?: string;
  resellerId?: string;
  name?: string;
  roleName?: string;
  permissions?: string[];
  /** Set when a superadmin opens a merchant or reseller panel */
  impersonatedBy?: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 10;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
  private static readonly JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRY as SignOptions["expiresIn"],
    });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Register a new merchant
   */
  static async registerMerchant(
    email: string,
    password: string,
    name: string,
    businessName: string,
    businessCategory?: "retail" | "restaurant"
  ) {
    const db = getDb();

    try {
      // Check if merchant already exists
      const existing = await db.query.merchants.findFirst({
        where: eq(schema.merchants.email, email),
      });

      if (existing) {
        throw new Error("Merchant already exists");
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      const lockedModule = normalizeBusinessModule(businessCategory);

      // Create merchant
      const merchant = await db
        .insert(schema.merchants)
        .values({
          email,
          passwordHash,
          name: businessName,
          status: "active",
          subscriptionPlan: "free",
          businessCategory: lockedModule,
        })
        .returning();

      if (lockedModule) {
        const modulePatch = businessModuleMerchantPatch(lockedModule, {});
        await db
          .update(schema.merchants)
          .set(modulePatch)
          .where(eq(schema.merchants.id, merchant[0].id));
      }

      return {
        id: merchant[0].id,
        email: merchant[0].email,
        name: merchant[0].name,
      };
    } catch (error) {
      console.error("Error registering merchant:", error);
      throw error;
    }
  }

  /**
   * Login merchant owner or staff with panel access
   */
  static async loginMerchant(email: string, password: string) {
    try {
      return await this.loginMerchantOwner(email, password);
    } catch (ownerError) {
      const ownerMessage = ownerError instanceof Error ? ownerError.message : "";
      if (ownerMessage.startsWith("Merchant account is")) {
        throw ownerError;
      }
      try {
        return await this.loginMerchantStaff(email, password);
      } catch (staffError) {
        const staffMessage = staffError instanceof Error ? staffError.message : "";
        const { StaffService } = await import("@/services/staff.service");
        if (StaffService.isLoginGuidanceError(staffMessage)) {
          throw staffError;
        }
        throw ownerError;
      }
    }
  }

  static async loginMerchantOwner(email: string, password: string) {
    const db = getDb();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const merchants = await withMerchantSchemaRetry(() =>
      db
        .select()
        .from(schema.merchants)
        .where(sql`lower(${schema.merchants.email}) = ${normalizedEmail}`)
        .limit(1)
    );
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

    const inventoryOn = await readInventoryAddonEnabled(merchant.id).catch(() =>
      isInventoryAddonEnabled(merchant.inventoryAddonEnabled)
    );
    const signage = await readSignageAddon(merchant.id).catch(() => ({
      enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
      screenLimit: 2,
    }));
    const kdsOn = await readKdsAddonEnabled(merchant.id).catch(() =>
      isKdsAddonEnabled(merchant.kdsAddonEnabled)
    );
    const odsOn = await readOdsAddonEnabled(merchant.id).catch(() =>
      isOdsAddonEnabled(merchant.odsAddonEnabled)
    );
    const storekeeperOn = await readStorekeeperAddonEnabled(merchant.id).catch(() => false);
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
        kdsAddonEnabled: kdsOn,
        kdsEnabled: kdsOn,
        odsAddonEnabled: odsOn,
        odsEnabled: odsOn,
        storekeeperAddonEnabled: storekeeperOn,
      },
      isOwner: true,
    };
  }

  static async loginMerchantStaff(email: string, password: string) {
    const { StaffService } = await import("@/services/staff.service");
    const { staff, role, permissions } = await StaffService.loginStaff(email, password);

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, staff.merchantId),
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

    const inventoryOn = await readInventoryAddonEnabled(staff.merchantId).catch(() => false);
    const signage = await readSignageAddon(staff.merchantId).catch(() => ({
      enabled: false,
      screenLimit: 2,
    }));
    const kdsOn = await readKdsAddonEnabled(staff.merchantId).catch(() => false);
    const odsOn = await readOdsAddonEnabled(staff.merchantId).catch(() => false);
    const storekeeperOn = await readStorekeeperAddonEnabled(staff.merchantId).catch(() => false);
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
        kdsAddonEnabled: kdsOn,
        kdsEnabled: kdsOn,
        odsAddonEnabled: odsOn,
        odsEnabled: odsOn,
        storekeeperAddonEnabled: storekeeperOn,
      },
      isOwner: false,
    };
  }

  /**
   * Register superadmin
   */
  static async registerSuperadmin(email: string, password: string, name: string) {
    const db = getDb();

    try {
      // Check if superadmin already exists
      const existing = await db.query.superadmins.findFirst({
        where: eq(schema.superadmins.email, email),
      });

      if (existing) {
        throw new Error("Superadmin already exists");
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create superadmin
      const superadmin = await db
        .insert(schema.superadmins)
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
    } catch (error) {
      console.error("Error registering superadmin:", error);
      throw error;
    }
  }

  /**
   * Unified panel login — merchant owner → staff → reseller → superadmin.
   * Does not replace PIN WebPOS or waiter PIN.
   */
  static async loginAny(email: string, password: string) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !password) {
      throw new Error("Email and password are required");
    }

    try {
      const merchant = await this.loginMerchantOwner(normalized, password);
      return {
        kind: "merchant" as const,
        token: merchant.token,
        merchant: merchant.merchant,
        isOwner: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("Merchant account is")) {
        throw error;
      }
    }

    try {
      const staff = await this.loginMerchantStaff(normalized, password);
      return {
        kind: "staff" as const,
        token: staff.token,
        merchant: staff.merchant,
        isOwner: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const { StaffService } = await import("@/services/staff.service");
      if (StaffService.isLoginGuidanceError(message)) {
        throw error;
      }
    }

    try {
      const { ResellerService } = await import("@/services/reseller.service");
      const reseller = await ResellerService.login(normalized, password);
      return { kind: "reseller" as const, token: reseller.token, reseller: reseller.reseller };
    } catch {
      /* try superadmin */
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.superadmins)
      .where(sql`lower(${schema.superadmins.email}) = ${normalized}`)
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
          kind: "superadmin" as const,
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
  static async loginSuperadmin(email: string, password: string) {
    const db = getDb();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    try {
      const rows = await db
        .select()
        .from(schema.superadmins)
        .where(sql`lower(${schema.superadmins.email}) = ${normalizedEmail}`)
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
    } catch (error) {
      console.error("Error logging in superadmin:", error);
      throw error;
    }
  }

  /**
   * Issue a merchant JWT so a superadmin can open that merchant's panel.
   */
  static async impersonateMerchant(superadminId: string, merchantId: string) {
    const db = getDb();

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
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

    const inventoryOn = await readInventoryAddonEnabled(merchant.id).catch(() =>
      isInventoryAddonEnabled(merchant.inventoryAddonEnabled)
    );
    const signage = await readSignageAddon(merchant.id).catch(() => ({
      enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
      screenLimit: 2,
    }));
    const kdsOn = await readKdsAddonEnabled(merchant.id).catch(() =>
      isKdsAddonEnabled(merchant.kdsAddonEnabled)
    );
    const odsOn = await readOdsAddonEnabled(merchant.id).catch(() =>
      isOdsAddonEnabled(merchant.odsAddonEnabled)
    );
    const storekeeperOn = await readStorekeeperAddonEnabled(merchant.id).catch(() => false);
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
        kdsAddonEnabled: kdsOn,
        kdsEnabled: kdsOn,
        odsAddonEnabled: odsOn,
        odsEnabled: odsOn,
        storekeeperAddonEnabled: storekeeperOn,
      },
      impersonatedBy: superadminId,
    };
  }

  /**
   * Verify merchant email (for password reset, etc.)
   */
  static async getMerchantById(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await withMerchantSchemaRetry(() =>
        db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
        })
      );

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      const inventoryOn = await readInventoryAddonEnabled(merchantId).catch(() =>
        isInventoryAddonEnabled(merchant.inventoryAddonEnabled)
      );
      const signage = await readSignageAddon(merchantId).catch(() => ({
        enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
        screenLimit: 2,
      }));
      const kdsOn = await readKdsAddonEnabled(merchantId).catch(() =>
        isKdsAddonEnabled(merchant.kdsAddonEnabled)
      );
      const odsOn = await readOdsAddonEnabled(merchantId).catch(() =>
        isOdsAddonEnabled(merchant.odsAddonEnabled)
      );
      const storekeeperOn = await readStorekeeperAddonEnabled(merchantId).catch(() => false);
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
        kdsAddonEnabled: kdsOn,
        kdsEnabled: kdsOn,
        odsAddonEnabled: odsOn,
        odsEnabled: odsOn,
        storekeeperAddonEnabled: storekeeperOn,
      };
    } catch (error) {
      console.error("Error getting merchant:", error);
      throw error;
    }
  }

  /**
   * Update merchant password
   */
  static async updateMerchantPassword(merchantId: string, newPassword: string) {
    const db = getDb();

    try {
      const passwordHash = await this.hashPassword(newPassword);

      await db
        .update(schema.merchants)
        .set({ passwordHash })
        .where(eq(schema.merchants.id, merchantId));

      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  }

  /**
   * Temporary login-page password reset (merchants / staff / superadmin by email).
   * Disable with ALLOW_LOGIN_PASSWORD_RESET=0.
   */
  static async resetLoginPasswordByEmail(
    role: "merchant" | "staff" | "superadmin" | "reseller",
    email: string,
    newPassword: string
  ) {
    if (process.env.ALLOW_LOGIN_PASSWORD_RESET === "0") {
      throw new Error("Password reset from login is disabled");
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new Error("Email is required");
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const db = getDb();
    const passwordHash = await this.hashPassword(newPassword);

    if (role === "merchant") {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.email, normalized),
      });
      if (!merchant) throw new Error("Merchant not found");
      await db
        .update(schema.merchants)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchant.id));
      return { success: true, role: "merchant" as const, email: merchant.email };
    }

    if (role === "staff") {
      const staffRows = await db
        .select()
        .from(schema.merchantStaff)
        .where(sql`lower(${schema.merchantStaff.email}) = ${normalized}`)
        .limit(1);
      const staff = staffRows[0];
      if (!staff) throw new Error("Staff user not found");
      await db
        .update(schema.merchantStaff)
        .set({ passwordHash, canAccessPanel: true, updatedAt: new Date() })
        .where(eq(schema.merchantStaff.id, staff.id));
      return { success: true, role: "staff" as const, email: staff.email || normalized };
    }

    if (role === "superadmin") {
      const admin = await db.query.superadmins.findFirst({
        where: eq(schema.superadmins.email, normalized),
      });
      if (!admin) throw new Error("Superadmin not found");
      await db
        .update(schema.superadmins)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.superadmins.id, admin.id));
      return { success: true, role: "superadmin" as const, email: admin.email };
    }

    // reseller
    const { ResellerService } = await import("@/services/reseller.service");
    const reseller = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, normalized),
    });
    if (!reseller) throw new Error("Reseller not found");
    await ResellerService.update(reseller.id, { password: newPassword });
    return { success: true, role: "reseller" as const, email: reseller.email };
  }
}
