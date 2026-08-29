import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PlatformResellerService } from "@/services/platform-reseller.service";

export type AddonInput = {
  name: string;
  slug: string;
  description?: string | null;
  addonKey: string;
  priceMonthly: number | string;
  priceYearly?: number | string | null;
  currency?: string;
  quantity?: number;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
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

const VALID_ADDON_KEYS = new Set([
  "inventory",
  "storekeeper",
  "signage",
  "kds",
  "ods",
  "kiosk",
  "just_eat",
  "uber_eats",
  "extra_pos_post",
  "extra_waiter_post",
  "extra_staff",
  "extra_location",
]);

export class SubscriptionAddonsService {
  static async listForReseller(resellerId: string, includeInactive = true) {
    const db = getDb();
    const rows = await db.query.subscriptionAddons.findMany({
      where: and(
        eq(schema.subscriptionAddons.ownerType, "reseller"),
        eq(schema.subscriptionAddons.ownerId, resellerId)
      ),
      orderBy: [asc(schema.subscriptionAddons.sortOrder), asc(schema.subscriptionAddons.name)],
    });
    if (includeInactive) return rows;
    return rows.filter((r) => r.isActive);
  }

  static async listAll(opts?: {
    includeInactive?: boolean;
    forResellerId?: string;
  }) {
    const resellerId =
      opts?.forResellerId || (await PlatformResellerService.getId());
    return this.listForReseller(resellerId, opts?.includeInactive !== false);
  }

  static async listPublicForMerchant(merchantId: string) {
    const sellerId = await PlatformResellerService.resolveForMerchant(merchantId);
    const db = getDb();
    return db.query.subscriptionAddons.findMany({
      where: and(
        eq(schema.subscriptionAddons.isActive, true),
        eq(schema.subscriptionAddons.isPublic, true),
        eq(schema.subscriptionAddons.ownerType, "reseller"),
        eq(schema.subscriptionAddons.ownerId, sellerId)
      ),
      orderBy: [asc(schema.subscriptionAddons.sortOrder), asc(schema.subscriptionAddons.name)],
    });
  }

  static async getById(id: string) {
    const db = getDb();
    const row = await db.query.subscriptionAddons.findFirst({
      where: eq(schema.subscriptionAddons.id, id),
    });
    if (!row) throw new Error("Add-on not found");
    return row;
  }

  static async create(input: AddonInput) {
    const db = getDb();
    const slug = normalizeSlug(input.slug || input.name);
    if (!slug) throw new Error("Add-on slug is required");
    const addonKey = String(input.addonKey || "").toLowerCase();
    if (!VALID_ADDON_KEYS.has(addonKey)) {
      throw new Error(`Invalid add-on key. Use: ${[...VALID_ADDON_KEYS].join(", ")}`);
    }
    const ownerType = "reseller" as const;
    const ownerId = input.ownerId;
    if (!ownerId) throw new Error("Reseller id is required for add-ons");

    const [row] = await db
      .insert(schema.subscriptionAddons)
      .values({
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        addonKey,
        priceMonthly: String(input.priceMonthly ?? 0),
        priceYearly:
          input.priceYearly === undefined || input.priceYearly === null || input.priceYearly === ""
            ? null
            : String(input.priceYearly),
        currency: (input.currency || "CHF").toUpperCase().slice(0, 3),
        quantity: input.quantity ?? 1,
        isActive: input.isActive !== false,
        isPublic: input.isPublic !== false,
        sortOrder: input.sortOrder ?? 0,
        ownerType,
        ownerId,
      })
      .returning();
    return row!;
  }

  static async update(id: string, input: Partial<AddonInput>) {
    const db = getDb();
    await this.getById(id);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.slug !== undefined) patch.slug = normalizeSlug(input.slug);
    if (input.description !== undefined) patch.description = input.description;
    if (input.addonKey !== undefined) {
      const key = String(input.addonKey).toLowerCase();
      if (!VALID_ADDON_KEYS.has(key)) throw new Error("Invalid add-on key");
      patch.addonKey = key;
    }
    if (input.priceMonthly !== undefined) patch.priceMonthly = String(input.priceMonthly);
    if (input.priceYearly !== undefined) {
      patch.priceYearly =
        input.priceYearly === null || input.priceYearly === "" ? null : String(input.priceYearly);
    }
    if (input.currency !== undefined) patch.currency = input.currency.toUpperCase().slice(0, 3);
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.isPublic !== undefined) patch.isPublic = input.isPublic;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

    const [row] = await db
      .update(schema.subscriptionAddons)
      .set(patch)
      .where(eq(schema.subscriptionAddons.id, id))
      .returning();
    return row!;
  }

  static async remove(id: string) {
    const db = getDb();
    await this.getById(id);
    const [row] = await db
      .update(schema.subscriptionAddons)
      .set({ isActive: false, isPublic: false, updatedAt: new Date() })
      .where(eq(schema.subscriptionAddons.id, id))
      .returning();
    return row!;
  }

  static async listActiveForMerchant(merchantId: string) {
    const db = getDb();
    return db.query.merchantAddonSubscriptions.findMany({
      where: and(
        eq(schema.merchantAddonSubscriptions.merchantId, merchantId),
        eq(schema.merchantAddonSubscriptions.status, "active")
      ),
      with: { addon: true },
    });
  }

  static async ensureDefaults() {
    const db = getDb();
    const { PlatformResellerService } = await import("@/services/platform-reseller.service");
    const platformResellerId = await PlatformResellerService.ensure();
    await PlatformResellerService.migrateCatalogOwnership();

    const existing = await db.query.subscriptionAddons.findMany({
      where: eq(schema.subscriptionAddons.ownerId, platformResellerId),
      limit: 1,
    });
    if (existing.length > 0) return;

    const defaults: AddonInput[] = [
      {
        name: "Inventory & recipes",
        slug: "inventory",
        addonKey: "inventory",
        description: "Stock, suppliers, recipes, and expiry alerts",
        priceMonthly: 29,
        priceYearly: 290,
        sortOrder: 10,
      },
      {
        name: "Digital signage",
        slug: "signage",
        addonKey: "signage",
        description: "Menu boards on TV screens",
        priceMonthly: 19,
        priceYearly: 190,
        quantity: 2,
        sortOrder: 20,
      },
      {
        name: "Kitchen display (KDS)",
        slug: "kds",
        addonKey: "kds",
        description: "Kitchen order screen",
        priceMonthly: 15,
        priceYearly: 150,
        sortOrder: 30,
      },
      {
        name: "Order display (ODS)",
        slug: "ods",
        addonKey: "ods",
        description: "Customer-facing order status screen",
        priceMonthly: 15,
        priceYearly: 150,
        sortOrder: 40,
      },
      {
        name: "Self-order kiosk",
        slug: "kiosk",
        addonKey: "kiosk",
        description: "Customer-facing self-order kiosk with card and cash payments",
        priceMonthly: 29,
        priceYearly: 290,
        sortOrder: 35,
      },
      {
        name: "Extra POS station",
        slug: "extra-pos",
        addonKey: "extra_pos_post",
        description: "One additional concurrent register",
        priceMonthly: 12,
        priceYearly: 120,
        quantity: 1,
        sortOrder: 50,
      },
      {
        name: "Extra waiter device",
        slug: "extra-waiter",
        addonKey: "extra_waiter_post",
        description: "One additional waiter station",
        priceMonthly: 8,
        priceYearly: 80,
        quantity: 1,
        sortOrder: 60,
      },
      {
        name: "Extra location",
        slug: "extra-location",
        addonKey: "extra_location",
        description: "One additional shop or branch location",
        priceMonthly: 15,
        priceYearly: 150,
        quantity: 1,
        sortOrder: 65,
      },
    ];

    for (const addon of defaults) {
      await this.create({ ...addon, ownerId: platformResellerId });
    }
    console.log("Seeded default subscription add-ons");
    await this.ensureMissingDefaultAddons(platformResellerId);
  }

  /** Add new catalog entries on existing installs without re-seeding everything. */
  static async ensureMissingDefaultAddons(platformResellerId?: string) {
    const db = getDb();
    const { PlatformResellerService } = await import("@/services/platform-reseller.service");
    const ownerId = platformResellerId || (await PlatformResellerService.ensure());

    const missing: AddonInput[] = [
      {
        name: "Just Eat integration",
        slug: "just-eat",
        addonKey: "just_eat",
        description: "Receive and manage Just Eat / JET Connect orders in POS",
        priceMonthly: 19,
        priceYearly: 190,
        sortOrder: 45,
      },
      {
        name: "Uber Eats integration",
        slug: "uber-eats",
        addonKey: "uber_eats",
        description: "Receive and manage Uber Eats orders in POS",
        priceMonthly: 19,
        priceYearly: 190,
        sortOrder: 46,
      },
      {
        name: "Storekeeper mobile app",
        slug: "storekeeper",
        addonKey: "storekeeper",
        description: "iPhone barcode scanning, stock intake, and POS publish for retail",
        priceMonthly: 15,
        priceYearly: 150,
        sortOrder: 15,
      },
      {
        name: "Extra location",
        slug: "extra-location",
        addonKey: "extra_location",
        description: "One additional shop or branch location",
        priceMonthly: 15,
        priceYearly: 150,
        quantity: 1,
        sortOrder: 65,
      },
      {
        name: "Self-order kiosk",
        slug: "kiosk",
        addonKey: "kiosk",
        description: "Customer-facing self-order kiosk with card and cash payments",
        priceMonthly: 29,
        priceYearly: 290,
        sortOrder: 35,
      },
    ];

    for (const addon of missing) {
      const existing = await db.query.subscriptionAddons.findFirst({
        where: and(
          eq(schema.subscriptionAddons.ownerId, ownerId),
          eq(schema.subscriptionAddons.slug, addon.slug)
        ),
      });
      if (!existing) {
        await this.create({ ...addon, ownerId });
      }
    }
  }
}
