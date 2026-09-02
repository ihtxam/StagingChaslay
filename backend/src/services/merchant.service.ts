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
import {
  businessModuleMerchantPatch,
  normalizeBusinessModule,
} from "@/lib/business-module";
import {
  isInventoryAddonEnabled,
  readInventoryAddonEnabled,
  readInventoryAddonEnabledMap,
  writeInventoryAddonEnabled,
} from "@/lib/inventory-addon";
import {
  isSignageAddonEnabled,
  normalizeSignageScreenLimit,
  readSignageAddon,
  readSignageAddonMap,
  writeSignageAddonEnabled,
  writeSignageScreenLimit,
} from "@/lib/signage-addon";
import {
  isKdsAddonEnabled,
  readKdsAddonEnabled,
  readKdsAddonEnabledMap,
  writeKdsAddonEnabled,
} from "@/lib/kds-addon";
import {
  isOdsAddonEnabled,
  readOdsAddonEnabled,
  readOdsAddonEnabledMap,
  writeOdsAddonEnabled,
} from "@/lib/ods-addon";
import {
  isJustEatAddonEnabled,
  isUberEatsAddonEnabled,
  readJustEatAddonEnabled,
  readUberEatsAddonEnabled,
  writeJustEatAddonEnabled,
  writeUberEatsAddonEnabled,
} from "@/lib/delivery-platform-addon";
import {
  isKioskAddonEnabled,
  readKioskAddonEnabled,
  readKioskAddonEnabledMap,
  writeKioskAddonEnabled,
} from "@/lib/kiosk-addon";
import {
  isStorekeeperAddonEnabled,
  writeStorekeeperAddonEnabled,
} from "@/lib/storekeeper-addon";

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

      const addonById = await readInventoryAddonEnabledMap(merchantIds).catch(
        () => new Map<string, boolean>()
      );
      const signageById = await readSignageAddonMap(merchantIds).catch(
        () => new Map<string, { enabled: boolean; screenLimit: number }>()
      );
      const kdsById = await readKdsAddonEnabledMap(merchantIds).catch(
        () => new Map<string, boolean>()
      );
      const odsById = await readOdsAddonEnabledMap(merchantIds).catch(
        () => new Map<string, boolean>()
      );
      const kioskById = await readKioskAddonEnabledMap(merchantIds).catch(
        () => new Map<string, boolean>()
      );

      return merchants.map((m) => {
        const floor = floorByMerchant.get(m.id) ?? [];
        const lastSeen = pickLastAppVersion([
          ...(m.devices ?? []).map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSync })),
          ...floor.map((d) => ({ appVersion: d.appVersion, seenAt: d.lastSeenAt })),
        ]);
        const inventoryOn =
          addonById.get(m.id) ?? isInventoryAddonEnabled(m.inventoryAddonEnabled);
        const signage = signageById.get(m.id);
        const signageOn = signage?.enabled ?? isSignageAddonEnabled(m.signageAddonEnabled);
        const kdsOn = kdsById.get(m.id) ?? isKdsAddonEnabled(m.kdsAddonEnabled);
        const odsOn = odsById.get(m.id) ?? isOdsAddonEnabled(m.odsAddonEnabled);
        const kioskOn = kioskById.get(m.id) ?? isKioskAddonEnabled(m.kioskAddonEnabled);
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
          signageScreenLimit: signage?.screenLimit ?? normalizeSignageScreenLimit(m.signageScreenLimit),
          kdsAddonEnabled: kdsOn,
          kdsEnabled: kdsOn,
          odsAddonEnabled: odsOn,
          odsEnabled: odsOn,
          kioskAddonEnabled: kioskOn,
          kioskEnabled: kioskOn,
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

      const inventoryOn = await readInventoryAddonEnabled(merchantId);
      const signage = await readSignageAddon(merchantId).catch(() => ({
        enabled: isSignageAddonEnabled(merchant.signageAddonEnabled),
        screenLimit: normalizeSignageScreenLimit(merchant.signageScreenLimit),
      }));
      const kdsOn = await readKdsAddonEnabled(merchantId).catch(() =>
        isKdsAddonEnabled(merchant.kdsAddonEnabled)
      );
      const odsOn = await readOdsAddonEnabled(merchantId).catch(() =>
        isOdsAddonEnabled(merchant.odsAddonEnabled)
      );
      const kioskOn = await readKioskAddonEnabled(merchantId).catch(() =>
        isKioskAddonEnabled(merchant.kioskAddonEnabled)
      );
      const justEatOn = await readJustEatAddonEnabled(merchantId).catch(() =>
        isJustEatAddonEnabled(merchant.justEatAddonEnabled)
      );
      const uberEatsOn = await readUberEatsAddonEnabled(merchantId).catch(() =>
        isUberEatsAddonEnabled(merchant.uberEatsAddonEnabled)
      );
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
        kioskAddonEnabled: kioskOn,
        kioskEnabled: kioskOn,
        justEatAddonEnabled: justEatOn,
        uberEatsAddonEnabled: uberEatsOn,
        deliveryPlatformsAddonEnabled: justEatOn || uberEatsOn,
        editionName: merchant.edition?.name ?? null,
        planBillingPaid: merchant.planBillingPaid !== false,
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
      /** Shop/branch locations. 1 = single shop; 0 = unlimited. Agency-assigned addon. */
      maxLocations?: number;
      inventoryAddonEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageScreenLimit?: number;
      kdsAddonEnabled?: boolean;
      odsAddonEnabled?: boolean;
      kioskAddonEnabled?: boolean;
      deliveryPlatformsAddonEnabled?: boolean;
      storekeeperAddonEnabled?: boolean;
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

      const lockedModule = normalizeBusinessModule(options?.businessCategory);

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
          businessCategory: lockedModule,
          maxPosPosts: normalizePosPostLimit(options?.maxPosPosts ?? 0),
          maxWaiterPosts: normalizePosPostLimit(options?.maxWaiterPosts ?? 0),
          maxLocations: normalizePosPostLimit(options?.maxLocations ?? 1) || 1,
          inventoryAddonEnabled: options?.inventoryAddonEnabled === true,
          signageAddonEnabled: options?.signageAddonEnabled === true,
          signageScreenLimit: normalizeSignageScreenLimit(options?.signageScreenLimit ?? 2),
          kdsAddonEnabled: options?.kdsAddonEnabled === true,
          odsAddonEnabled: options?.odsAddonEnabled === true,
          kioskAddonEnabled: options?.kioskAddonEnabled === true,
          justEatAddonEnabled: options?.deliveryPlatformsAddonEnabled === true,
          uberEatsAddonEnabled: options?.deliveryPlatformsAddonEnabled === true,
        })
        .returning();

      const created = merchant[0];

      if (options?.editionId) {
        const { EditionService } = await import("./edition.service");
        await EditionService.applyEditionDefaultsToMerchant(created.id, options.editionId, {
          businessCategory: lockedModule || options?.businessCategory,
        });
      } else if (lockedModule) {
        const modulePatch = businessModuleMerchantPatch(lockedModule, {});
        await db
          .update(schema.merchants)
          .set(modulePatch)
          .where(eq(schema.merchants.id, created.id));
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

      // Default: send invite when no password was set; admin can also force sendInvite: true
      const sendInvite = options?.sendInvite ?? !hasPassword;
      let invite: Awaited<
        ReturnType<typeof import("./merchant-invite.service").MerchantInviteService.sendInviteEmail>
      > | null = null;

      if (sendInvite) {
        const { MerchantInviteService } = await import("./merchant-invite.service");
        invite = await MerchantInviteService.sendInviteEmail(created.id);
      }

      const { StaffService } = await import("./staff.service");
      await StaffService.ensureDefaultManagerStaff(created.id, _contactName || businessName);

      const refreshed = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, created.id),
      });
      const row = refreshed || created;
      if (options?.inventoryAddonEnabled === true) {
        await writeInventoryAddonEnabled(created.id, true);
      }
      if (options?.signageAddonEnabled === true) {
        await writeSignageAddonEnabled(created.id, true);
      }
      if (options?.signageScreenLimit != null) {
        await writeSignageScreenLimit(created.id, options.signageScreenLimit);
      }
      if (options?.kdsAddonEnabled === true) {
        await writeKdsAddonEnabled(created.id, true);
      }
      if (options?.odsAddonEnabled === true) {
        await writeOdsAddonEnabled(created.id, true);
      }
      if (options?.kioskAddonEnabled === true) {
        await writeKioskAddonEnabled(created.id, true);
      }
      if (options?.deliveryPlatformsAddonEnabled === true) {
        await writeJustEatAddonEnabled(created.id, true);
        await writeUberEatsAddonEnabled(created.id, true);
      }
      const inventoryOn = await readInventoryAddonEnabled(created.id).catch(() => false);
      const signage = await readSignageAddon(created.id).catch(() => ({
        enabled: false,
        screenLimit: 2,
      }));
      const kdsOn = await readKdsAddonEnabled(created.id).catch(() => false);
      const odsOn = await readOdsAddonEnabled(created.id).catch(() => false);

      // Don't leak password hash to API clients
      const { passwordHash: _ph, inviteTokenHash: _ith, ...safe } = row as typeof row & {
        passwordHash: string;
        inviteTokenHash?: string | null;
      };

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
        justEatAddonEnabled: options?.deliveryPlatformsAddonEnabled === true,
        uberEatsAddonEnabled: options?.deliveryPlatformsAddonEnabled === true,
        deliveryPlatformsAddonEnabled: options?.deliveryPlatformsAddonEnabled === true,
        issuedLicenses,
        invite,
        passwordSet: hasPassword,
      };
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
      const addonRequested = updates.inventoryAddonEnabled;
      const signageRequested = updates.signageAddonEnabled;
      const kdsRequested = updates.kdsAddonEnabled;
      const odsRequested = updates.odsAddonEnabled;
      const kioskRequested = updates.kioskAddonEnabled;
      if (addonRequested !== undefined) {
        await ensureInventoryAddonColumn();
        updates.inventoryAddonEnabled = isInventoryAddonEnabled(addonRequested);
      }
      if (signageRequested !== undefined) {
        updates.signageAddonEnabled = isSignageAddonEnabled(signageRequested);
      }
      if (kdsRequested !== undefined) {
        updates.kdsAddonEnabled = isKdsAddonEnabled(kdsRequested);
      }
      if (odsRequested !== undefined) {
        updates.odsAddonEnabled = isOdsAddonEnabled(odsRequested);
      }
      if (kioskRequested !== undefined) {
        updates.kioskAddonEnabled = isKioskAddonEnabled(kioskRequested);
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

      if (addonRequested !== undefined) {
        const on = await writeInventoryAddonEnabled(merchantId, addonRequested);
        Object.assign(merchant[0], { inventoryAddonEnabled: on });
      }
      if (signageRequested !== undefined) {
        const on = await writeSignageAddonEnabled(merchantId, signageRequested);
        Object.assign(merchant[0], { signageAddonEnabled: on, signageEnabled: on });
      }
      if (kdsRequested !== undefined) {
        const on = await writeKdsAddonEnabled(merchantId, kdsRequested);
        Object.assign(merchant[0], { kdsAddonEnabled: on, kdsEnabled: on });
      }
      if (odsRequested !== undefined) {
        const on = await writeOdsAddonEnabled(merchantId, odsRequested);
        Object.assign(merchant[0], { odsAddonEnabled: on, odsEnabled: on });
      }
      if (kioskRequested !== undefined) {
        const on = await writeKioskAddonEnabled(merchantId, kioskRequested);
        Object.assign(merchant[0], { kioskAddonEnabled: on, kioskEnabled: on });
      }
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
      maxLocations?: number;
      inventoryAddonEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageScreenLimit?: number;
      kdsAddonEnabled?: boolean;
      odsAddonEnabled?: boolean;
      kioskAddonEnabled?: boolean;
      deliveryPlatformsAddonEnabled?: boolean;
      storekeeperAddonEnabled?: boolean;
    }
  ) {
    const patch: Partial<typeof schema.merchants.$inferInsert> = {};
    if (limits.maxPosPosts !== undefined) {
      patch.maxPosPosts = normalizePosPostLimit(limits.maxPosPosts);
    }
    if (limits.maxWaiterPosts !== undefined) {
      patch.maxWaiterPosts = normalizePosPostLimit(limits.maxWaiterPosts);
    }
    if (limits.maxLocations !== undefined) {
      const n = normalizePosPostLimit(limits.maxLocations);
      patch.maxLocations = n === 0 ? 0 : Math.max(1, n);
    }
    if (Object.keys(patch).length > 0) {
      await this.updateMerchant(merchantId, patch);
    }
    let wroteAddon = false;
    if (limits.inventoryAddonEnabled !== undefined) {
      await writeInventoryAddonEnabled(merchantId, limits.inventoryAddonEnabled);
      wroteAddon = true;
    }
    if (limits.signageAddonEnabled !== undefined) {
      await writeSignageAddonEnabled(merchantId, limits.signageAddonEnabled);
      wroteAddon = true;
    }
    if (limits.signageScreenLimit !== undefined) {
      await writeSignageScreenLimit(merchantId, limits.signageScreenLimit);
      wroteAddon = true;
    }
    if (limits.kdsAddonEnabled !== undefined) {
      await writeKdsAddonEnabled(merchantId, limits.kdsAddonEnabled);
      wroteAddon = true;
    }
    if (limits.odsAddonEnabled !== undefined) {
      await writeOdsAddonEnabled(merchantId, limits.odsAddonEnabled);
      wroteAddon = true;
    }
    if (limits.deliveryPlatformsAddonEnabled !== undefined) {
      await writeJustEatAddonEnabled(merchantId, limits.deliveryPlatformsAddonEnabled);
      await writeUberEatsAddonEnabled(merchantId, limits.deliveryPlatformsAddonEnabled);
      wroteAddon = true;
    }
    if (limits.kioskAddonEnabled !== undefined) {
      await writeKioskAddonEnabled(merchantId, limits.kioskAddonEnabled);
      wroteAddon = true;
    }
    if (limits.storekeeperAddonEnabled !== undefined) {
      await writeStorekeeperAddonEnabled(merchantId, limits.storekeeperAddonEnabled);
      wroteAddon = true;
    }
    if (!wroteAddon && Object.keys(patch).length === 0) {
      throw new Error(
        "At least one of maxPosPosts, maxWaiterPosts, maxLocations, inventoryAddonEnabled, signageAddonEnabled, signageScreenLimit, kdsAddonEnabled, odsAddonEnabled, kioskAddonEnabled, storekeeperAddonEnabled, or deliveryPlatformsAddonEnabled is required"
      );
    }
    return this.getMerchantById(merchantId);
  }

  /** Superadmin / owning reseller: change POS edition and plan billing flag. */
  static async updateMerchantPlan(
    merchantId: string,
    input: {
      editionId?: string | null;
      planBillingPaid?: boolean;
      subscriptionPlan?: string;
    },
    opts?: { forResellerId?: string; allowClearEdition?: boolean }
  ) {
    const hasEdition = input.editionId !== undefined;
    const hasPaid = input.planBillingPaid !== undefined;
    const hasSubPlan = input.subscriptionPlan !== undefined;
    if (!hasEdition && !hasPaid && !hasSubPlan) {
      throw new Error("At least one of editionId, planBillingPaid, or subscriptionPlan is required");
    }

    const db = getDb();
    const existing = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true },
    });
    if (!existing) throw new Error("Merchant not found");

    const patch: Partial<typeof schema.merchants.$inferInsert> = {};
    if (hasPaid) patch.planBillingPaid = !!input.planBillingPaid;
    if (hasSubPlan) {
      const planSlug = String(input.subscriptionPlan || "").trim();
      if (!planSlug) throw new Error("Subscription plan is required");
      const { SubscriptionPlansService } = await import("./subscription-plans.service");
      const plan = await SubscriptionPlansService.getBySlug(planSlug);
      if (!plan || !plan.isActive) throw new Error("Subscription plan not found or inactive");
      patch.subscriptionPlan = plan.slug;
    }

    if (hasEdition) {
      if (input.editionId === null) {
        if (!opts?.allowClearEdition) throw new Error("POS version is required");
        patch.editionId = null;
      } else {
        const editionId = String(input.editionId || "").trim();
        if (!editionId) throw new Error("POS version is required");
        const { EditionService } = await import("./edition.service");
        const edition = await EditionService.getById(editionId);
        if (!edition || !edition.isActive) throw new Error("POS version not found or inactive");
        if (opts?.forResellerId) {
          const allowedEdition =
            edition.ownerType === "platform" ||
            (edition.ownerType === "reseller" && edition.ownerId === opts.forResellerId);
          if (!allowedEdition) throw new Error("POS version not available for this reseller");
        }
        if (Object.keys(patch).length) {
          await this.updateMerchant(merchantId, patch);
        }
        await EditionService.applyEditionDefaultsToMerchant(merchantId, editionId);
        const { PackageProvisioningService } = await import("./package-provisioning.service");
        await PackageProvisioningService.applyEditionFeatureAddons(
          merchantId,
          edition.features as import("@/lib/edition-features").EditionFeatureKey[] | null
        );
        return this.getMerchantById(merchantId);
      }
    }

    if (Object.keys(patch).length) {
      await this.updateMerchant(merchantId, patch);
    }
    return this.getMerchantById(merchantId);
  }

  /** Paid addons are agency/reseller-managed — merchants cannot self-enable. */
  static async updateAddons(
    merchantId: string,
    addons: {
      inventoryAddonEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageScreenLimit?: number;
      kdsAddonEnabled?: boolean;
      odsAddonEnabled?: boolean;
      kioskAddonEnabled?: boolean;
    }
  ) {
    if (
      addons.inventoryAddonEnabled === undefined &&
      addons.signageAddonEnabled === undefined &&
      addons.signageScreenLimit === undefined &&
      addons.kdsAddonEnabled === undefined &&
      addons.odsAddonEnabled === undefined &&
      addons.kioskAddonEnabled === undefined
    ) {
      throw new Error("No addon updates provided");
    }
    if (addons.inventoryAddonEnabled !== undefined) {
      await writeInventoryAddonEnabled(merchantId, addons.inventoryAddonEnabled);
    }
    if (addons.signageAddonEnabled !== undefined) {
      await writeSignageAddonEnabled(merchantId, addons.signageAddonEnabled);
    }
    if (addons.signageScreenLimit !== undefined) {
      await writeSignageScreenLimit(merchantId, addons.signageScreenLimit);
    }
    if (addons.kdsAddonEnabled !== undefined) {
      await writeKdsAddonEnabled(merchantId, addons.kdsAddonEnabled);
    }
    if (addons.odsAddonEnabled !== undefined) {
      await writeOdsAddonEnabled(merchantId, addons.odsAddonEnabled);
    }
    if (addons.kioskAddonEnabled !== undefined) {
      await writeKioskAddonEnabled(merchantId, addons.kioskAddonEnabled);
    }
    return this.getMerchantById(merchantId);
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

      await MerchantService.revokeAllAuthSessions(merchantId);

      return merchant[0];
    } catch (error) {
      console.error("Error suspending merchant:", error);
      throw error;
    }
  }

  /**
   * Invalidate all dashboard JWTs and revoke active POS/waiter device sessions.
   */
  static async revokeAllAuthSessions(merchantId: string) {
    const { AuthService } = await import("@/services/auth.service");
    const { PosSessionsService } = await import("@/services/pos-sessions.service");
    await AuthService.bumpMerchantAuthEpoch(merchantId);
    await PosSessionsService.revokeAllForMerchant(merchantId);
    return { ok: true };
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
