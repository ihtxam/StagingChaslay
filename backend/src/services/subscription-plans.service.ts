import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PackageIncludedAddons } from "@/db/schema";
import { queryRaw, withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";
import { PlatformResellerService } from "@/services/platform-reseller.service";

/** Columns that existed on the original subscription_plans table (pre editions / addons). */
export type LegacyPlanLimits = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly?: string | number;
  priceYearly?: string | number | null;
  currency?: string;
  maxDevices: number;
  maxProducts: number | null;
  maxPosPosts: number;
  maxWaiterPosts: number;
  maxStaff: number;
  maxLocations: number;
  features?: string[];
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  trialDays?: number;
};

function asLimit(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapLegacyPlanRow(row: Record<string, unknown>): LegacyPlanLimits {
  const maxProductsRaw = row.max_products ?? row.maxProducts;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: (row.description as string | null | undefined) ?? null,
    priceMonthly: (row.price_monthly ?? row.priceMonthly) as string | number | undefined,
    priceYearly: (row.price_yearly ?? row.priceYearly) as string | number | null | undefined,
    currency: (row.currency as string | undefined) || "CHF",
    maxDevices: asLimit(row.max_devices ?? row.maxDevices, 0),
    maxProducts:
      maxProductsRaw === null || maxProductsRaw === undefined
        ? null
        : asLimit(maxProductsRaw, 0),
    maxPosPosts: asLimit(row.max_pos_posts ?? row.maxPosPosts, 0),
    maxWaiterPosts: asLimit(row.max_waiter_posts ?? row.maxWaiterPosts, 0),
    maxStaff: asLimit(row.max_staff ?? row.maxStaff, 0),
    maxLocations: asLimit(row.max_locations ?? row.maxLocations, 1),
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    isActive: row.is_active !== false && row.isActive !== false,
    isPublic: row.is_public !== false && row.isPublic !== false,
    sortOrder: asLimit(row.sort_order ?? row.sortOrder, 0),
    trialDays: asLimit(row.trial_days ?? row.trialDays, 0),
  };
}

export type PlanInput = {
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: number | string;
  priceYearly?: number | string | null;
  currency?: string;
  editionId?: string | null;
  maxDevices?: number;
  maxProducts?: number | null;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  maxStaff?: number;
  includedAddons?: PackageIncludedAddons;
  features?: string[];
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  trialDays?: number;
  ownerType?: "platform" | "reseller";
  ownerId?: string | null;
};

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export class SubscriptionPlansService {
  /** Packages owned by one reseller (including Reborn Direct). */
  static async listForReseller(resellerId: string, includeInactive = true) {
    const db = getDb();
    const plans = await db.query.subscriptionPlans.findMany({
      where: and(
        eq(schema.subscriptionPlans.ownerType, "reseller"),
        eq(schema.subscriptionPlans.ownerId, resellerId)
      ),
      orderBy: [asc(schema.subscriptionPlans.sortOrder), asc(schema.subscriptionPlans.name)],
      with: { edition: true },
    });
    if (includeInactive) return plans;
    return plans.filter((p) => p.isActive);
  }

  static async listAll(
    includeInactive = true,
    opts?: {
      forResellerId?: string;
    }
  ) {
    if (!opts?.forResellerId) {
      const platformId = await PlatformResellerService.getId();
      return this.listForReseller(platformId, includeInactive);
    }
    return this.listForReseller(opts.forResellerId, includeInactive);
  }

  /** @deprecated Use listForReseller(platformResellerId) */
  static async listPublic() {
    const platformId = await PlatformResellerService.getId();
    return this.listForReseller(platformId, false).then((plans) =>
      plans.filter((p) => p.isPublic)
    );
  }

  static async listPublicForMerchant(merchantId: string) {
    const sellerId = await PlatformResellerService.resolveForMerchant(merchantId);
    const db = getDb();
    return db.query.subscriptionPlans.findMany({
      where: and(
        eq(schema.subscriptionPlans.isActive, true),
        eq(schema.subscriptionPlans.isPublic, true),
        eq(schema.subscriptionPlans.ownerType, "reseller"),
        eq(schema.subscriptionPlans.ownerId, sellerId)
      ),
      orderBy: [asc(schema.subscriptionPlans.sortOrder), asc(schema.subscriptionPlans.name)],
      with: { edition: true },
    });
  }

  static async getById(id: string) {
    try {
      const plan = await withMerchantSchemaRetry(async () => {
        const db = getDb();
        return db.query.subscriptionPlans.findFirst({
          where: eq(schema.subscriptionPlans.id, id),
        });
      });
      if (!plan) throw new Error("Plan not found");
      return plan;
    } catch (error) {
      const legacy = await this.getByIdLegacy(id);
      if (!legacy) throw error instanceof Error ? error : new Error("Plan not found");
      return legacy as unknown as typeof schema.subscriptionPlans.$inferSelect;
    }
  }

  /**
   * Plan lookup for POS / product / staff limits.
   * Never joins `editions` and never selects columns added after the original
   * packages table — production catalog must load even when drizzle-kit OOM'd.
   */
  static async getBySlugForLimits(slug: string): Promise<LegacyPlanLimits | undefined> {
    const normalized = normalizeSlug(slug);
    if (!normalized) return undefined;

    try {
      const db = getDb();
      const [row] = await db
        .select({
          id: schema.subscriptionPlans.id,
          name: schema.subscriptionPlans.name,
          slug: schema.subscriptionPlans.slug,
          description: schema.subscriptionPlans.description,
          priceMonthly: schema.subscriptionPlans.priceMonthly,
          priceYearly: schema.subscriptionPlans.priceYearly,
          currency: schema.subscriptionPlans.currency,
          maxDevices: schema.subscriptionPlans.maxDevices,
          maxProducts: schema.subscriptionPlans.maxProducts,
          features: schema.subscriptionPlans.features,
          isActive: schema.subscriptionPlans.isActive,
          isPublic: schema.subscriptionPlans.isPublic,
          sortOrder: schema.subscriptionPlans.sortOrder,
          trialDays: schema.subscriptionPlans.trialDays,
        })
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.slug, normalized))
        .limit(1);
      if (row) {
        const extras = await this.selectNewerPlanColumns(normalized);
        return mapLegacyPlanRow({ ...row, ...extras });
      }
    } catch (error) {
      console.warn("[plans] drizzle core select failed, using legacy SQL:", error);
    }

    return this.getBySlugLegacy(normalized);
  }

  static async getBySlug(slug: string) {
    const normalized = normalizeSlug(slug);
    try {
      return await withMerchantSchemaRetry(async () => {
        const db = getDb();
        return db.query.subscriptionPlans.findFirst({
          where: eq(schema.subscriptionPlans.slug, normalized),
        });
      });
    } catch (error) {
      console.warn("[plans] getBySlug relational query failed, using legacy SQL:", error);
      const legacy = await this.getBySlugLegacy(normalized);
      return legacy as unknown as typeof schema.subscriptionPlans.$inferSelect | undefined;
    }
  }

  /** Newer limit columns — queried separately so a missing column cannot abort the catalog. */
  private static async selectNewerPlanColumns(slug: string): Promise<Record<string, unknown>> {
    try {
      const db = getDb();
      const [row] = await db
        .select({
          maxPosPosts: schema.subscriptionPlans.maxPosPosts,
          maxWaiterPosts: schema.subscriptionPlans.maxWaiterPosts,
          maxStaff: schema.subscriptionPlans.maxStaff,
          maxLocations: schema.subscriptionPlans.maxLocations,
        })
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.slug, slug))
        .limit(1);
      return row || {};
    } catch {
      return {};
    }
  }

  private static async getBySlugLegacy(slug: string): Promise<LegacyPlanLimits | undefined> {
    try {
      const rows = await queryRaw(
        `SELECT id, name, slug, description, price_monthly, price_yearly, currency,
                max_devices, max_products, features, is_active, is_public, sort_order, trial_days
         FROM subscription_plans
         WHERE slug = $1
         LIMIT 1`,
        [slug]
      );
      const row = rows[0];
      return row ? mapLegacyPlanRow(row) : undefined;
    } catch (error) {
      console.warn("[plans] legacy slug lookup failed:", error);
      return undefined;
    }
  }

  private static async getByIdLegacy(id: string): Promise<LegacyPlanLimits | undefined> {
    try {
      const rows = await queryRaw(
        `SELECT id, name, slug, description, price_monthly, price_yearly, currency,
                max_devices, max_products, features, is_active, is_public, sort_order, trial_days
         FROM subscription_plans
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      const row = rows[0];
      return row ? mapLegacyPlanRow(row) : undefined;
    } catch (error) {
      console.warn("[plans] legacy id lookup failed:", error);
      return undefined;
    }
  }

  static async create(input: PlanInput) {
    const db = getDb();
    const slug = normalizeSlug(input.slug || input.name);
    if (!slug) throw new Error("Plan slug is required");
    if (!input.name?.trim()) throw new Error("Plan name is required");

    const existing = await this.getBySlug(slug);
    if (existing) throw new Error(`Plan slug "${slug}" already exists`);

    const ownerType = "reseller" as const;
    const ownerId = input.ownerId;
    if (!ownerId) throw new Error("Reseller id is required for packages");

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        priceMonthly: String(input.priceMonthly ?? 0),
        priceYearly:
          input.priceYearly === undefined || input.priceYearly === null || input.priceYearly === ""
            ? null
            : String(input.priceYearly),
        currency: (input.currency || "CHF").toUpperCase().slice(0, 3),
        editionId: input.editionId || null,
        maxDevices: input.maxDevices ?? 1,
        maxProducts: input.maxProducts ?? null,
        maxPosPosts: input.maxPosPosts ?? 0,
        maxWaiterPosts: input.maxWaiterPosts ?? 0,
        maxStaff: input.maxStaff ?? 0,
        includedAddons: input.includedAddons || {},
        features: input.features || [],
        isActive: input.isActive !== false,
        isPublic: input.isPublic !== false,
        sortOrder: input.sortOrder ?? 0,
        trialDays: input.trialDays ?? 0,
        ownerType,
        ownerId,
      })
      .returning();

    return plan!;
  }

  static async update(id: string, input: Partial<PlanInput>) {
    const db = getDb();
    await this.getById(id);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.slug !== undefined) {
      const slug = normalizeSlug(input.slug);
      if (!slug) throw new Error("Plan slug is required");
      const existing = await this.getBySlug(slug);
      if (existing && existing.id !== id) throw new Error(`Plan slug "${slug}" already exists`);
      patch.slug = slug;
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.priceMonthly !== undefined) patch.priceMonthly = String(input.priceMonthly);
    if (input.priceYearly !== undefined) {
      patch.priceYearly =
        input.priceYearly === null || input.priceYearly === ""
          ? null
          : String(input.priceYearly);
    }
    if (input.currency !== undefined) patch.currency = input.currency.toUpperCase().slice(0, 3);
    if (input.editionId !== undefined) patch.editionId = input.editionId || null;
    if (input.maxDevices !== undefined) patch.maxDevices = input.maxDevices;
    if (input.maxProducts !== undefined) patch.maxProducts = input.maxProducts;
    if (input.maxPosPosts !== undefined) patch.maxPosPosts = input.maxPosPosts;
    if (input.maxWaiterPosts !== undefined) patch.maxWaiterPosts = input.maxWaiterPosts;
    if (input.maxStaff !== undefined) patch.maxStaff = input.maxStaff;
    if (input.includedAddons !== undefined) patch.includedAddons = input.includedAddons;
    if (input.features !== undefined) patch.features = input.features;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.isPublic !== undefined) patch.isPublic = input.isPublic;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    if (input.trialDays !== undefined) patch.trialDays = input.trialDays;

    const [plan] = await db
      .update(schema.subscriptionPlans)
      .set(patch)
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();

    return plan!;
  }

  static async remove(id: string) {
    const db = getDb();
    await this.getById(id);
    const [plan] = await db
      .update(schema.subscriptionPlans)
      .set({ isActive: false, isPublic: false, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();
    return plan!;
  }

  static async ensureDefaults() {
    const db = getDb();
    const { PlatformResellerService } = await import("@/services/platform-reseller.service");
    const platformResellerId = await PlatformResellerService.ensure();
    await PlatformResellerService.migrateCatalogOwnership();

    const existing = await db.query.subscriptionPlans.findMany({
      where: eq(schema.subscriptionPlans.ownerId, platformResellerId),
      limit: 1,
    });
    if (existing.length > 0) return;

    const { EditionService } = await import("@/services/edition.service");
    await EditionService.ensureDefaults();
    const retailEdition = await db.query.editions.findFirst({
      where: and(eq(schema.editions.ownerType, "platform"), eq(schema.editions.name, "Retail Basic")),
    });
    const restaurantEdition = await db.query.editions.findFirst({
      where: and(eq(schema.editions.ownerType, "platform"), eq(schema.editions.name, "Restaurant Pro")),
    });

    const defaults: PlanInput[] = [
      {
        name: "Free",
        slug: "free",
        description: "Get started with basic POS features",
        priceMonthly: 0,
        priceYearly: 0,
        editionId: retailEdition?.id,
        maxDevices: 1,
        maxProducts: 50,
        maxPosPosts: 1,
        maxWaiterPosts: 0,
        maxStaff: 3,
        features: ["1 POS station", "Up to 50 products", "Online shop"],
        sortOrder: 0,
      },
      {
        name: "Starter",
        slug: "starter",
        description: "For small food trucks and cafés",
        priceMonthly: 49,
        priceYearly: 490,
        editionId: restaurantEdition?.id,
        maxDevices: 2,
        maxProducts: 200,
        maxPosPosts: 2,
        maxWaiterPosts: 2,
        maxStaff: 5,
        features: ["2 POS stations", "2 waiter devices", "Up to 200 products", "Online shop", "Loyalty"],
        sortOrder: 10,
      },
      {
        name: "Professional",
        slug: "professional",
        description: "Growing restaurants with multi-device needs",
        priceMonthly: 99,
        priceYearly: 990,
        editionId: restaurantEdition?.id,
        maxDevices: 5,
        maxProducts: null,
        maxPosPosts: 5,
        maxWaiterPosts: 5,
        maxStaff: 15,
        includedAddons: { kds: true },
        features: ["5 POS stations", "5 waiter devices", "Unlimited products", "KDS included", "Priority support"],
        sortOrder: 20,
      },
      {
        name: "Enterprise",
        slug: "enterprise",
        description: "Multi-location and custom requirements",
        priceMonthly: 199,
        priceYearly: 1990,
        editionId: restaurantEdition?.id,
        maxDevices: 25,
        maxProducts: null,
        maxPosPosts: 0,
        maxWaiterPosts: 0,
        maxStaff: 0,
        includedAddons: { inventory: true, signage: true, kds: true, ods: true, signageScreenLimit: 5 },
        features: ["Unlimited stations", "All add-ons included", "Dedicated support"],
        sortOrder: 30,
      },
    ];

    for (const plan of defaults) {
      await this.create({ ...plan, ownerId: platformResellerId });
    }
    console.log("Seeded default subscription plans");
  }
}
