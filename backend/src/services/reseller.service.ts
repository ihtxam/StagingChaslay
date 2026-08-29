import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";
import { EditionService } from "@/services/edition.service";
import { MerchantService } from "@/services/merchant.service";
import { LicenseAdminService } from "@/services/license-admin.service";
import { ResellerBillingService } from "@/services/reseller-billing.service";
import { isInventoryAddonEnabled } from "@/lib/inventory-addon";
import { isSignageAddonEnabled, normalizeSignageScreenLimit } from "@/lib/signage-addon";

function serializeReseller(
  row: typeof schema.resellers.$inferSelect,
  extras?: {
    merchantCount?: number;
    seatsUsed?: number;
    activeOrTrialCount?: number;
    suspendedCount?: number;
    billableMerchantCount?: number;
    deviceCount?: number;
  }
) {
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

export class ResellerService {
  static async countSeatsUsed(resellerId: string): Promise<number> {
    const db = getDb();
    // Active seats only ? revoked/suspended licenses free pool capacity
    const [{ c }] = await db
      .select({ c: count() })
      .from(schema.licenses)
      .where(
        and(
          eq(schema.licenses.issuedByResellerId, resellerId),
          eq(schema.licenses.status, "active")
        )
      );
    return Number(c || 0);
  }

  static async getSeatPool(resellerId: string) {
    const db = getDb();
    const row = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, resellerId),
    });
    if (!row) throw new Error("Reseller not found");
    const seatsUsed = await this.countSeatsUsed(resellerId);
    return {
      licenseSeats: row.licenseSeats ?? 0,
      seatsUsed,
      seatsRemaining: Math.max(0, (row.licenseSeats ?? 0) - seatsUsed),
    };
  }

  static async assertSeatCapacity(resellerId: string, seatsNeeded: number) {
    const need = Math.max(0, Math.floor(seatsNeeded));
    if (need <= 0) return this.getSeatPool(resellerId);
    const pool = await this.getSeatPool(resellerId);
    if (pool.seatsRemaining < need) {
      throw new Error(
        `Insufficient license seats: need ${need}, remaining ${pool.seatsRemaining} (allocated ${pool.licenseSeats})`
      );
    }
    return pool;
  }

  /** Superadmin sets absolute allocated seat pool (or delta via mode). */
  static async allocateLicenseSeats(
    resellerId: string,
    input: { seats?: number; delta?: number }
  ) {
    const db = getDb();
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, resellerId),
    });
    if (!existing) throw new Error("Reseller not found");

    let next = existing.licenseSeats ?? 0;
    if (input.seats != null) {
      next = Math.max(0, Math.floor(Number(input.seats)));
    } else if (input.delta != null) {
      next = Math.max(0, next + Math.floor(Number(input.delta)));
    } else {
      throw new Error("Provide seats (absolute) or delta");
    }

    const seatsUsed = await this.countSeatsUsed(resellerId);
    if (next < seatsUsed) {
      throw new Error(
        `Cannot set allocated seats to ${next}: ${seatsUsed} already issued to merchants`
      );
    }

    const [row] = await db
      .update(schema.resellers)
      .set({ licenseSeats: next, updatedAt: new Date() })
      .where(eq(schema.resellers.id, resellerId))
      .returning();
    return this.getById(row!.id);
  }

  static async ensureChaslayAgency(createdBySuperadminId?: string | null) {
    const db = getDb();
    const email = (process.env.SEED_RESELLER_EMAIL || "agency@rebornsense.com").toLowerCase();
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, email),
    });
    if (existing) return serializeReseller(existing);

    const password = process.env.SEED_RESELLER_PASSWORD || "ChaslayAgency123!";
    const name = process.env.SEED_RESELLER_NAME || "Reborn";
    const passwordHash = await AuthService.hashPassword(password);
    const [row] = await db
      .insert(schema.resellers)
      .values({
        name,
        email,
        passwordHash,
        status: "active",
        createdBySuperadminId: createdBySuperadminId || null,
      })
      .returning();

    // Attach legacy merchants without reseller to this agency + Full edition
    const fullId = await EditionService.getLegacyFullEditionId();
    if (row) {
      await db
        .update(schema.merchants)
        .set({ resellerId: row.id, updatedAt: new Date() })
        .where(isNull(schema.merchants.resellerId));
      if (fullId) {
        await db
          .update(schema.merchants)
          .set({ editionId: fullId, updatedAt: new Date() })
          .where(and(eq(schema.merchants.resellerId, row.id), isNull(schema.merchants.editionId)));
      }
    }

    return serializeReseller(row!);
  }

  static async list(opts?: { search?: string; status?: string }) {
    await this.ensureChaslayAgency();
    const db = getDb();
    const clauses = [];
    if (opts?.status) clauses.push(eq(schema.resellers.status, opts.status));
    if (opts?.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      clauses.push(or(ilike(schema.resellers.name, q), ilike(schema.resellers.email, q))!);
    }
    const rows = await db
      .select()
      .from(schema.resellers)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(schema.resellers.createdAt));

    const statsMap = await ResellerBillingService.getResellerStatsMap(rows.map((r) => r.id));
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

  static async getById(id: string) {
    const db = getDb();
    const row = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, id),
    });
    if (!row) return null;
    const statsMap = await ResellerBillingService.getResellerStatsMap([id]);
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

  static async create(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    createdBySuperadminId?: string;
    licenseSeats?: number;
  }) {
    const db = getDb();
    const email = String(input.email || "").trim().toLowerCase();
    if (!email || !input.name?.trim()) throw new Error("Name and email are required");
    if (!input.password || input.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, email),
    });
    if (existing) throw new Error("Email already registered");

    const passwordHash = await AuthService.hashPassword(input.password);
    const [row] = await db
      .insert(schema.resellers)
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
    return serializeReseller(row!);
  }

  static async update(
    id: string,
    input: { name?: string; phone?: string; status?: string; password?: string; licenseSeats?: number }
  ) {
    const db = getDb();
    const existing = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, id),
    });
    if (!existing) throw new Error("Reseller not found");

    const patch: Partial<typeof schema.resellers.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
    if (input.status !== undefined) {
      patch.status = ["active", "suspended"].includes(input.status) ? input.status : existing.status;
    }
    if (input.password) {
      if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
      patch.passwordHash = await AuthService.hashPassword(input.password);
    }
    if (input.licenseSeats !== undefined) {
      const next = Math.max(0, Math.floor(Number(input.licenseSeats)));
      const seatsUsed = await this.countSeatsUsed(id);
      if (next < seatsUsed) {
        throw new Error(
          `Cannot set allocated seats to ${next}: ${seatsUsed} already issued to merchants`
        );
      }
      patch.licenseSeats = next;
    }
    const [row] = await db
      .update(schema.resellers)
      .set(patch)
      .where(eq(schema.resellers.id, id))
      .returning();
    return this.getById(row!.id);
  }

  static async login(email: string, password: string) {
    const db = getDb();
    const row = await db.query.resellers.findFirst({
      where: eq(schema.resellers.email, String(email || "").trim().toLowerCase()),
    });
    if (!row || row.status !== "active") throw new Error("Invalid credentials");
    const ok = await AuthService.comparePassword(password, row.passwordHash);
    if (!ok) throw new Error("Invalid credentials");

    const token = AuthService.generateToken({
      id: row.id,
      email: row.email,
      role: "reseller",
      name: row.name,
      resellerId: row.id,
    });
    return {
      token,
      reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" as const },
    };
  }

  static async impersonateToken(resellerId: string, impersonatedBy: string) {
    const row = await this.getById(resellerId);
    if (!row) throw new Error("Reseller not found");
    if (row.status !== "active") throw new Error("Reseller is suspended");
    const token = AuthService.generateToken({
      id: row.id,
      email: row.email,
      role: "reseller",
      name: row.name,
      resellerId: row.id,
      impersonatedBy,
    });
    return {
      token,
      reseller: { id: row.id, email: row.email, name: row.name, role: "reseller" as const },
    };
  }

  static async listMerchants(resellerId: string, opts?: { search?: string; status?: string }) {
    const db = getDb();
    const clauses = [eq(schema.merchants.resellerId, resellerId)];
    if (opts?.status) clauses.push(eq(schema.merchants.status, opts.status));
    if (opts?.search?.trim()) {
      const q = `%${opts.search.trim()}%`;
      clauses.push(
        or(
          ilike(schema.merchants.name, q),
          ilike(schema.merchants.email, q),
          ilike(schema.merchants.slug, q)
        )!
      );
    }
    const rows = await db
      .select({
        id: schema.merchants.id,
        name: schema.merchants.name,
        email: schema.merchants.email,
        status: schema.merchants.status,
        slug: schema.merchants.slug,
        editionId: schema.merchants.editionId,
        editionName: schema.editions.name,
        subscriptionPlan: schema.merchants.subscriptionPlan,
        planBillingPaid: schema.merchants.planBillingPaid,
        shopEnabled: schema.merchants.shopEnabled,
        maxPosPosts: schema.merchants.maxPosPosts,
        maxWaiterPosts: schema.merchants.maxWaiterPosts,
        maxLocations: schema.merchants.maxLocations,
        inventoryAddonEnabled: schema.merchants.inventoryAddonEnabled,
        signageAddonEnabled: schema.merchants.signageAddonEnabled,
        signageScreenLimit: schema.merchants.signageScreenLimit,
        kdsAddonEnabled: schema.merchants.kdsAddonEnabled,
        odsAddonEnabled: schema.merchants.odsAddonEnabled,
        justEatAddonEnabled: schema.merchants.justEatAddonEnabled,
        uberEatsAddonEnabled: schema.merchants.uberEatsAddonEnabled,
        createdAt: schema.merchants.createdAt,
      })
      .from(schema.merchants)
      .leftJoin(schema.editions, eq(schema.merchants.editionId, schema.editions.id))
      .where(and(...clauses))
      .orderBy(desc(schema.merchants.createdAt));
    return rows.map((r) => ({
      ...r,
      editionName: r.editionName ?? null,
      planBillingPaid: r.planBillingPaid !== false,
      inventoryAddonEnabled: isInventoryAddonEnabled(r.inventoryAddonEnabled),
      signageAddonEnabled: isSignageAddonEnabled(r.signageAddonEnabled),
      signageScreenLimit: normalizeSignageScreenLimit(r.signageScreenLimit),
      kdsAddonEnabled: r.kdsAddonEnabled === true,
      odsAddonEnabled: r.odsAddonEnabled === true,
      deliveryPlatformsAddonEnabled:
        r.justEatAddonEnabled === true || r.uberEatsAddonEnabled === true,
    }));
  }

  static async createMerchantForReseller(
    resellerId: string,
    input: {
      email: string;
      password?: string;
      businessName: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      editionId: string;
      businessCategory?: "retail" | "restaurant";
      shopEnabled?: boolean;
      deviceSeats?: number;
      licenseType?: "trial" | "yearly" | "custom";
      customDays?: number;
      sendInvite?: boolean;
      maxPosPosts?: number;
      maxWaiterPosts?: number;
      maxLocations?: number;
      inventoryAddonEnabled?: boolean;
      signageAddonEnabled?: boolean;
      signageScreenLimit?: number;
      kdsAddonEnabled?: boolean;
      odsAddonEnabled?: boolean;
      deliveryPlatformsAddonEnabled?: boolean;
      storekeeperAddonEnabled?: boolean;
    }
  ) {
    const reseller = await this.getById(resellerId);
    if (!reseller || reseller.status !== "active") throw new Error("Reseller not available");

    const edition = await EditionService.getById(input.editionId);
    if (!edition || !edition.isActive) throw new Error("Invalid edition");
    const allowedOwner =
      (edition.ownerType === "platform" && !edition.ownerId) ||
      (edition.ownerType === "reseller" && edition.ownerId === resellerId);
    if (!allowedOwner) throw new Error("Edition not available for this reseller");

    const seats = Math.max(0, Math.min(20, Number(input.deviceSeats) || 0));
    if (seats > 0) {
      await this.assertSeatCapacity(resellerId, seats);
    }

    const created = await MerchantService.createMerchant(
      input.email,
      input.password,
      input.businessName,
      undefined,
      input.phone,
      input.address,
      input.city,
      input.country,
      {
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
        maxLocations: input.maxLocations,
        inventoryAddonEnabled: input.inventoryAddonEnabled,
        signageAddonEnabled: input.signageAddonEnabled,
        signageScreenLimit: input.signageScreenLimit,
        kdsAddonEnabled: input.kdsAddonEnabled,
        odsAddonEnabled: input.odsAddonEnabled,
        deliveryPlatformsAddonEnabled: input.deliveryPlatformsAddonEnabled,
        storekeeperAddonEnabled: input.storekeeperAddonEnabled,
      }
    );
    return created;
  }

  static async updateMerchantPosLimits(
    resellerId: string,
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
      deliveryPlatformsAddonEnabled?: boolean;
      storekeeperAddonEnabled?: boolean;
    }
  ) {
    await this.assertOwnsMerchant(resellerId, merchantId);
    const { MerchantService } = await import("./merchant.service");
    await MerchantService.updatePosPostLimits(merchantId, {
      maxPosPosts: limits.maxPosPosts,
      maxWaiterPosts: limits.maxWaiterPosts,
      maxLocations: limits.maxLocations,
      inventoryAddonEnabled: limits.inventoryAddonEnabled,
      signageAddonEnabled: limits.signageAddonEnabled,
      signageScreenLimit: limits.signageScreenLimit,
      kdsAddonEnabled: limits.kdsAddonEnabled,
      odsAddonEnabled: limits.odsAddonEnabled,
      deliveryPlatformsAddonEnabled: limits.deliveryPlatformsAddonEnabled,
      storekeeperAddonEnabled: limits.storekeeperAddonEnabled,
    });
    return MerchantService.getMerchantById(merchantId);
  }

  /** Change POS edition / billing flag for an owned merchant. */
  static async updateOwnedMerchantPlan(
    resellerId: string,
    merchantId: string,
    input: {
      editionId?: string | null;
      planBillingPaid?: boolean;
      subscriptionPlan?: string;
    }
  ) {
    await this.assertOwnsMerchant(resellerId, merchantId);
    const { MerchantService } = await import("./merchant.service");
    return MerchantService.updateMerchantPlan(merchantId, input, { forResellerId: resellerId });
  }

  /** Suspend a merchant this reseller owns. Same status flag as superadmin suspend. */
  static async suspendOwnedMerchant(resellerId: string, merchantId: string, reason?: string) {
    const owned = await this.assertOwnsMerchant(resellerId, merchantId);
    if (owned.status === "expired") {
      throw new Error("Cannot suspend an expired merchant");
    }
    if (owned.status === "suspended") {
      return owned;
    }
    const { MerchantService } = await import("./merchant.service");
    return MerchantService.suspendMerchant(merchantId, reason);
  }

  /** Reactivate a merchant this reseller previously suspended. */
  static async reactivateOwnedMerchant(resellerId: string, merchantId: string) {
    const owned = await this.assertOwnsMerchant(resellerId, merchantId);
    if (owned.status !== "suspended") {
      throw new Error("Merchant is not suspended");
    }
    const { MerchantService } = await import("./merchant.service");
    return MerchantService.reactivateMerchant(merchantId);
  }

  static async assertOwnsMerchant(resellerId: string, merchantId: string) {
    const db = getDb();
    const m = await db.query.merchants.findFirst({
      where: and(eq(schema.merchants.id, merchantId), eq(schema.merchants.resellerId, resellerId)),
      columns: { id: true, status: true, name: true },
    });
    if (!m) throw new Error("Merchant not found");
    return m;
  }

  /**
   * List licenses for merchants owned by this reseller only.
   */
  static async listLicenses(
    resellerId: string,
    opts?: { status?: string; merchantId?: string; page?: number; limit?: number }
  ) {
    const db = getDb();
    const page = Math.max(1, opts?.page || 1);
    const limit = Math.min(100, Math.max(1, opts?.limit || 20));
    const offset = (page - 1) * limit;

    const owned = await db
      .select({ id: schema.merchants.id })
      .from(schema.merchants)
      .where(eq(schema.merchants.resellerId, resellerId));
    const merchantIds = owned.map((m) => m.id);
    if (!merchantIds.length) return [];

    if (opts?.merchantId && !merchantIds.includes(opts.merchantId)) {
      throw new Error("Merchant not found");
    }

    const clauses = [
      opts?.merchantId
        ? eq(schema.licenses.merchantId, opts.merchantId)
        : inArray(schema.licenses.merchantId, merchantIds),
    ];
    if (opts?.status) clauses.push(eq(schema.licenses.status, opts.status));

    return db.query.licenses.findMany({
      where: and(...clauses),
      with: { merchant: true, device: true },
      limit,
      offset,
      orderBy: desc(schema.licenses.createdAt),
    });
  }

  /** Issue device seats from reseller pool to an owned merchant. */
  static async issueDeviceSeats(
    resellerId: string,
    input: {
      merchantId: string;
      seats?: number;
      licenseType?: "trial" | "yearly" | "custom";
      customDays?: number;
      deviceType?: string;
      posDeviceId?: string;
      mode?: "seats" | "device";
    }
  ) {
    await this.assertOwnsMerchant(resellerId, input.merchantId);

    if (input.mode === "device" || input.posDeviceId?.trim()) {
      // New seats need pool capacity; reuse of an existing active license is free.
      const poolBefore = await this.getSeatPool(resellerId);
      if (poolBefore.seatsRemaining < 1) {
        // Still allow returning an existing active code (no new seat)
        const peek = await LicenseAdminService.issueForPosDeviceId(
          input.merchantId,
          String(input.posDeviceId || "").trim(),
          input.licenseType || "yearly",
          input.customDays,
          input.deviceType || "tablet",
          null
        );
        if (!peek.reused) {
          await LicenseAdminService.revokeLicense(peek.licenseId);
          throw new Error(
            `Insufficient license seats: need 1, remaining 0 (allocated ${poolBefore.licenseSeats})`
          );
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
      const result = await LicenseAdminService.issueForPosDeviceId(
        input.merchantId,
        String(input.posDeviceId || "").trim(),
        input.licenseType || "yearly",
        input.customDays,
        input.deviceType || "tablet",
        resellerId
      );
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
    const issued = await LicenseAdminService.issueDeviceSeats(
      input.merchantId,
      seats,
      input.licenseType || "yearly",
      input.customDays,
      input.deviceType || "tablet",
      resellerId
    );
    return { licenses: issued, pool: await this.getSeatPool(resellerId) };
  }

  static async revokeOwnedLicense(resellerId: string, licenseId: string) {
    const db = getDb();
    const license = await db.query.licenses.findFirst({
      where: eq(schema.licenses.id, licenseId),
      with: { merchant: true },
    });
    if (!license || license.merchant?.resellerId !== resellerId) {
      throw new Error("License not found");
    }
    return LicenseAdminService.revokeLicense(licenseId);
  }

  static async extendOwnedLicense(resellerId: string, licenseId: string, additionalDays: number) {
    const db = getDb();
    const license = await db.query.licenses.findFirst({
      where: eq(schema.licenses.id, licenseId),
      with: { merchant: true },
    });
    if (!license || license.merchant?.resellerId !== resellerId) {
      throw new Error("License not found");
    }
    return LicenseAdminService.extendLicense(licenseId, additionalDays);
  }
}
