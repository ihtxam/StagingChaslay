import crypto from "crypto";
import { getDb, schema } from "@/db";
import { eq, and, like, desc, or, lt, gt, inArray } from "drizzle-orm";
import { AuthService } from "./auth.service";
import { generateSyncApiKey } from "./chaslay-compat.service";
import { withLicenseSchemaRetry } from "@/lib/ensure-licenses-schema";
import {
  ensureInventoryAddonColumn,
  withMerchantSchemaRetry,
} from "@/lib/ensure-merchant-schema";
import { isInventoryAddonEnabled } from "@/lib/inventory-addon";

type AppVersionSighting = {
  appVersion?: string | null;
  seenAt?: Date | string | null;
};

function pickLastAppVersion(rows: AppVersionSighting[]): {
  lastAppVersion: string | null;
  lastAppVersionSeenAt: Date | null;
} {
  let best: { version: string; seenAt: number } | null = null;
  for (const row of rows) {
    const version = String(row.appVersion || "").trim();
    if (!version) continue;
    const seenAt = row.seenAt ? new Date(row.seenAt).getTime() : 0;
    if (!Number.isFinite(seenAt)) continue;
    if (!best || seenAt >= best.seenAt) {
      best = { version, seenAt };
    }
  }
  return {
    lastAppVersion: best?.version ?? null,
    lastAppVersionSeenAt: best && best.seenAt ? new Date(best.seenAt) : null,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cryptoRandomSecret() {
  return crypto.randomBytes(48).toString("hex");
}

export function normalizePosPostLimit(value: unknown): number {
  return Math.max(0, Math.min(99, Number(value) || 0));
}

export class MerchantService {
  /**
   * Get all merchants with pagination + device/license counts
   */
  static async getAllMerchants(page: number = 1, limit: number = 20, search?: string) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      const where = search
        ? or(
            like(schema.merchants.name, `%${search}%`),
            like(schema.merchants.email, `%${search}%`),
            like(schema.merchants.slug, `%${search}%`)
          )
        : undefined;

      const merchants = await withLicenseSchemaRetry(() =>
        db.query.merchants.findMany({
          where,
          limit,
          offset,
          orderBy: desc(schema.merchants.createdAt),
          with: {
            devices: true,
            licenses: true,
            edition: true,
          },
        })
      );

      const merchantIds = merchants.map((m) => m.id);
      const floorDevices =
        merchantIds.length > 0
          ? await db.query.chaslayFloorDevices.findMany({
              where: inArray(schema.chaslayFloorDevices.merchantId, merchantIds),
            })
          : [];
      const floorByMerchant = new Map<string, typeof floorDevices>();
      for (const row of floorDevices) {
        const list = floorByMerchant.get(row.merchantId) ?? [];
        list.push(row);
        floorByMerchant.set(row.merchantId, list);
      }

      return merchants.map((m) => {
        const floor = floorByMerchant.get(m.id) ?? [];
        const lastSeen = pickLastAppVersion([
          ...(m.devices ?? []).map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSync })),
          ...floor.map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSeenAt })),
        ]);
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
          lastAppVersion: lastSeen.lastAppVersion,
          lastAppVersionSeenAt: lastSeen.lastAppVersionSeenAt,
          resellerId: m.resellerId ?? null,
          createdAt: m.createdAt,
          devices: m.devices?.length ?? 0,
          licenses: m.licenses?.length ?? 0,
          activeLicenses: m.licenses?.filter((l) => l.status === "active").length ?? 0,
        };
      });
    } catch (error) {
      console.error("Error getting merchants:", error);
      throw error;
    }
  }

  /**
   * Get merchant by ID
   */
  static async getMerchantById(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await withMerchantSchemaRetry(() =>
        db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          with: {
            devices: true,
            licenses: true,
            edition: true,
            orders: {
              limit: 10,
              orderBy: desc(schema.orders.createdAt),
            },
          },
        })
      );

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      const floorDevices = await db.query.chaslayFloorDevices.findMany({
        where: eq(schema.chaslayFloorDevices.merchantId, merchantId),
      });
      const lastSeen = pickLastAppVersion([
        ...(merchant.devices ?? []).map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSync })),
        ...floorDevices.map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSeenAt })),
      ]);

      return {
        ...merchant,
        inventoryAddonEnabled: isInventoryAddonEnabled(merchant.inventoryAddonEnabled),
        inventoryEnabled: isInventoryAddonEnabled(merchant.inventoryAddonEnabled),
        editionName: merchant.edition?.name ?? null,
        lastAppVersion: lastSeen.lastAppVersion,
        lastAppVersionSeenAt: lastSeen.lastAppVersionSeenAt,
      };
    } catch (error) {
      console.error("Error getting merchant:", error);
      throw error;
    }
  }

  /**
   * Create merchant (by superadmin)
   */
  static async createMerchant(
    email: string,
    password: string | undefined,
    businessName: string,
    _contactName?: string,
    phone?: string,
    address?: string,
    city?: string,
    country?: string,
    options?: {
      slug?: string;
      shopEnabled?: boolean;
      subscriptionPlan?: string;
      status?: string;
      deviceSeats?: number;
      licenseType?: "trial" | "yearly" | "custom";
      customDays?: number;
      /** When set, issued device seats count against this reseller's pool */
      issuedByResellerId?: string;
      /** Send password-setup invite email after create (default true when no password) */
      sendInvite?: boolean;
      editionId?: string;
      resellerId?: string;
      businessCategory?: "retail" | "restaurant";
      /** Concurrent main POS stations (WebPOS + Android). 0 = unlimited. Agency-assigned. */
      maxPosPosts?: number;
      /** Concurrent waiter stations. 0 = unlimited. Agency-assigned. */
      maxWaiterPosts?: number;
      inventoryAddonEnabled?: boolean;
    }
  ) {
    const db = getDb();

    try {
      const existing = await db.query.merchants.findFirst({
        where: eq(schema.merchants.email, email),
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
        ? await AuthService.hashPassword(password!.trim())
        : await AuthService.hashPassword(cryptoRandomSecret());
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      let slug = options?.slug ? slugify(options.slug) : slugify(businessName);
      if (slug) {
        const slugTaken = await db.query.merchants.findFirst({
          where: eq(schema.merchants.slug, slug),
        });
        if (slugTaken) {
          slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }
      }

      const merchant = await db
        .insert(schema.merchants)
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
          syncApiKey: generateSyncApiKey(),
          editionId: options?.editionId || null,
          resellerId: options?.resellerId || null,
          maxPosPosts: normalizePosPostLimit(options?.maxPosPosts ?? 0),
          maxWaiterPosts: normalizePosPostLimit(options?.maxWaiterPosts ?? 0),
          inventoryAddonEnabled: options?.inventoryAddonEnabled === true,
        })
        .returning();

      const created = merchant[0];

      if (options?.editionId) {
        const { EditionService } = await import("./edition.service");
        await EditionService.applyEditionDefaultsToMerchant(created.id, options.editionId);
      } else if (options?.businessCategory === "retail") {
        const checkout =
          created.posCheckoutSettings && typeof created.posCheckoutSettings === "object"
            ? { ...(created.posCheckoutSettings as Record<string, unknown>) }
            : {};
        checkout.posMode = "retail";
        await db
          .update(schema.merchants)
          .set({
            floorPlanEnabled: false,
            coursesEnabled: false,
            posCheckoutSettings: checkout,
            updatedAt: new Date(),
          })
          .where(eq(schema.merchants.id, created.id));
      }

      let issuedLicenses: Array<{ deviceId: string; deviceName: string; licenseKey: string; expiresAt: Date }> = [];

      const seats = Math.max(0, Math.min(20, options?.deviceSeats ?? 0));
      if (seats > 0) {
        const { LicenseAdminService } = await import("./license-admin.service");
        const issued = await LicenseAdminService.issueDeviceSeats(
          created.id,
          seats,
          options?.licenseType || "yearly",
          options?.customDays,
          "tablet",
          options?.issuedByResellerId || null
        );
        issuedLicenses = issued;
      }

      // Seed default Manager staff with PIN 1234 so WebPOS PIN gate works for new merchants.
      try {
        const { StaffService } = await import("./staff.service");
        await StaffService.ensureDefaultPosStaff(created.id, businessName);
      } catch (staffErr) {
        console.error("Failed to seed default POS staff:", staffErr);
      }

      // Default: send invite when no password was set; admin can also force sendInvite: true
      const sendInvite = options?.sendInvite ?? !hasPassword;
      let invite: Awaited<
        ReturnType<typeof import("./merchant-invite.service").MerchantInviteService.sendInviteEmail>
      > | null = null;

      if (sendInvite) {
        const { MerchantInviteService } = await import("./merchant-invite.service");
        invite = await MerchantInviteService.sendInviteEmail(created.id);
      }

      const refreshed = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, created.id),
      });
      const row = refreshed || created;

      // Don't leak password hash to API clients
      const { passwordHash: _ph, inviteTokenHash: _ith, ...safe } = row as typeof row & {
        passwordHash: string;
        inviteTokenHash?: string | null;
      };

      return { ...safe, issuedLicenses, invite, passwordSet: hasPassword };
    } catch (error) {
      console.error("Error creating merchant:", error);
      throw error;
    }
  }

  /**
   * Update merchant details
   */
  static async updateMerchant(merchantId: string, updates: Partial<typeof schema.merchants.$inferInsert>) {
    const db = getDb();

    try {
      if (updates.inventoryAddonEnabled !== undefined) {
        await ensureInventoryAddonColumn();
        updates.inventoryAddonEnabled = isInventoryAddonEnabled(updates.inventoryAddonEnabled);
      }
      const merchant = await withMerchantSchemaRetry(() =>
        db
          .update(schema.merchants)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(schema.merchants.id, merchantId))
          .returning()
      );

      return merchant[0];
    } catch (error) {
      console.error("Error updating merchant:", error);
      throw error;
    }
  }

  /** POS post limits + paid addons are agency/reseller-managed — not merchant self-service. */
  static async updatePosPostLimits(
    merchantId: string,
    limits: {
      maxPosPosts?: number;
      maxWaiterPosts?: number;
      inventoryAddonEnabled?: boolean;
    }
  ) {
    const patch: Partial<typeof schema.merchants.$inferInsert> = {};
    if (limits.maxPosPosts !== undefined) {
      patch.maxPosPosts = normalizePosPostLimit(limits.maxPosPosts);
    }
    if (limits.maxWaiterPosts !== undefined) {
      patch.maxWaiterPosts = normalizePosPostLimit(limits.maxWaiterPosts);
    }
    if (limits.inventoryAddonEnabled !== undefined) {
      patch.inventoryAddonEnabled = isInventoryAddonEnabled(limits.inventoryAddonEnabled);
    }
    if (Object.keys(patch).length === 0) {
      throw new Error("At least one of maxPosPosts, maxWaiterPosts, or inventoryAddonEnabled is required");
    }
    return this.updateMerchant(merchantId, patch);
  }

  /** Paid addons are agency/reseller-managed — merchants cannot self-enable. */
  static async updateAddons(merchantId: string, addons: { inventoryAddonEnabled?: boolean }) {
    const patch: Partial<typeof schema.merchants.$inferInsert> = {};
    if (addons.inventoryAddonEnabled !== undefined) {
      patch.inventoryAddonEnabled = isInventoryAddonEnabled(addons.inventoryAddonEnabled);
    }
    if (Object.keys(patch).length === 0) {
      throw new Error("No addon updates provided");
    }
    return this.updateMerchant(merchantId, patch);
  }

  /**
   * Suspend merchant account
   */
  static async suspendMerchant(merchantId: string, reason?: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error suspending merchant:", error);
      throw error;
    }
  }

  /**
   * Reactivate merchant account
   */
  static async reactivateMerchant(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error reactivating merchant:", error);
      throw error;
    }
  }

  /**
   * Delete merchant (soft delete)
   */
  static async deleteMerchant(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error deleting merchant:", error);
      throw error;
    }
  }

  /**
   * Get merchant analytics
   */
  static async getMerchantAnalytics(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      // Get order count and total revenue
      const orders = await db.query.orders.findMany({
        where: eq(schema.orders.merchantId, merchantId),
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      // Get device count
      const devices = await db.query.devices.findMany({
        where: eq(schema.devices.merchantId, merchantId),
      });

      // Get license info
      const licenses = await db.query.licenses.findMany({
        where: eq(schema.licenses.merchantId, merchantId),
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
    } catch (error) {
      console.error("Error getting merchant analytics:", error);
      throw error;
    }
  }

  /**
   * Upgrade merchant subscription
   */
  static async upgradeMerchantSubscription(
    merchantId: string,
    plan: "starter" | "professional" | "enterprise"
  ) {
    const db = getDb();

    try {
      const merchant = await db
        .update(schema.merchants)
        .set({
          subscriptionPlan: plan,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId))
        .returning();

      return merchant[0];
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      throw error;
    }
  }

  /**
   * Get merchants by status
   */
  static async getMerchantsByStatus(status: string) {
    const db = getDb();

    try {
      const merchants = await db.query.merchants.findMany({
        where: eq(schema.merchants.status, status),
        orderBy: desc(schema.merchants.createdAt),
      });

      return merchants;
    } catch (error) {
      console.error("Error getting merchants by status:", error);
      throw error;
    }
  }

  /**
   * Get merchants with expiring licenses
   */
  static async getMerchantsWithExpiringLicenses(daysThreshold: number = 35) {
    const db = getDb();

    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

      const licenses = await db.query.licenses.findMany({
        where: and(
          eq(schema.licenses.status, "active"),
          lt(schema.licenses.expiresAt, thresholdDate),
          gt(schema.licenses.expiresAt, now)
        ),
        with: {
          merchant: true,
        },
      });

      return licenses.map((l) => ({
        merchant: l.merchant,
        expiresAt: l.expiresAt,
        daysRemaining: Math.ceil((l.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));
    } catch (error) {
      console.error("Error getting merchants with expiring licenses:", error);
      throw error;
    }
  }
}
