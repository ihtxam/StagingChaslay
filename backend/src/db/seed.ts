import dotenv from "dotenv";
import { and, eq, like } from "drizzle-orm";
import { getDb, schema } from "./index";
import { AuthService } from "../services/auth.service";
import { generateSyncApiKey } from "../services/chaslay-compat.service";
import { SubscriptionPlansService } from "../services/subscription-plans.service";
import { resolveShopPublicHost } from "../lib/brand";

dotenv.config();

/** Open all day every channel — keeps demo shop orderable after seed. */
const ALWAYS_OPEN = {
  takeaway: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
  dine_in: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
  delivery: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
};

const DEFAULT_SUPERADMIN_NAME = "Reborn Admin";

function resolveSuperadminName(raw?: string): string {
  const name = (raw || "").trim();
  if (!name || /manupos|reborn\s+admin/i.test(name)) return DEFAULT_SUPERADMIN_NAME;
  return name;
}

async function renameLeftoverSuperadminLabels(db: ReturnType<typeof getDb>) {
  const rows = await db
    .select({ id: schema.superadmins.id, name: schema.superadmins.name })
    .from(schema.superadmins);
  for (const row of rows) {
    if (!row.name || !/manupos|reborn\s+admin/i.test(row.name)) continue;
    await db
      .update(schema.superadmins)
      .set({ name: DEFAULT_SUPERADMIN_NAME, updatedAt: new Date() })
      .where(eq(schema.superadmins.id, row.id));
    console.log(`Renamed leftover superadmin label to ${DEFAULT_SUPERADMIN_NAME}: ${row.id}`);
  }
}

async function seedSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL || "admin@rebornsense.com";
  const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMeNow!123";
  const name = resolveSuperadminName(process.env.SEED_SUPERADMIN_NAME);
  const db = getDb();

  const existing = await db
    .select()
    .from(schema.superadmins)
    .where(eq(schema.superadmins.email, email))
    .limit(1);

  if (existing.length > 0) {
    // Keep password in sync with SEED_SUPERADMIN_PASSWORD so deploys can recover lockouts
    if (password && password !== "replace-with-strong-admin-password") {
      const passwordHash = await AuthService.hashPassword(password);
      await db
        .update(schema.superadmins)
        .set({ passwordHash, name, isActive: true, updatedAt: new Date() })
        .where(eq(schema.superadmins.id, existing[0]!.id));
      console.log(`Superadmin password synced from SEED_SUPERADMIN_PASSWORD: ${email}`);
    } else {
      console.log(`Superadmin already exists: ${email}`);
    }
    await renameLeftoverSuperadminLabels(db);
    return;
  }

  const superadmin = await AuthService.registerSuperadmin(email, password, name);
  console.log("Seeded superadmin:", superadmin.email);
  await renameLeftoverSuperadminLabels(db);
}

async function seedDemoShop() {
  if (process.env.SEED_DEMO_SHOP === "false") {
    console.log("SEED_DEMO_SHOP=false — skipping demo merchant");
    return;
  }

  const db = getDb();
  const email = process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@rebornsense.com";
  const password = process.env.SEED_DEMO_MERCHANT_PASSWORD || "DemoShop123!";
  const slug = process.env.SEED_DEMO_SLUG || "demo";
  // Keep Android BuildConfig SYNC_API_KEY working when present
  const syncApiKey =
    process.env.SEED_DEMO_SYNC_API_KEY || "ihtsham_76875hgf755rjgkjh7zrzrhvjhv";

  let merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.slug, slug),
  });

  if (!merchant) {
    const byEmail = await db.query.merchants.findFirst({
      where: eq(schema.merchants.email, email),
    });
    if (byEmail) {
      merchant = byEmail;
    }
  }

  if (!merchant) {
    const passwordHash = await AuthService.hashPassword(password);
    const inserted = await db
      .insert(schema.merchants)
      .values({
        email,
        passwordHash,
        name: process.env.SEED_DEMO_MERCHANT_NAME || "Demo Food Truck",
        phone: "+41 79 000 00 00",
        address: "Bahnhofstrasse 1",
        city: "Zürich",
        country: "CH",
        slug,
        subdomain: slug,
        shopEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
        deliveryEnabled: true,
        storeHours: ALWAYS_OPEN,
        status: "active",
        subscriptionPlan: "starter",
        syncApiKey: syncApiKey || generateSyncApiKey(),
        vatRate: "8.10",
        taxTakeawayRate: "8.10",
        taxDineInRate: "8.10",
        taxDeliveryRate: "8.10",
        panelLanguage: "en",
      })
      .returning();
    merchant = inserted[0]!;
    console.log(`Seeded demo merchant: ${merchant.email} (slug=${slug})`);
    console.log(`  Shop: https://${resolveShopPublicHost()}/${slug} or /shop/${slug}`);
    console.log(`  Sync API key: ${merchant.syncApiKey}`);
  } else {
    await db
      .update(schema.merchants)
      .set({
        shopEnabled: true,
        slug: merchant.slug || slug,
        subdomain: merchant.subdomain || slug,
        pickupEnabled: true,
        dineInEnabled: true,
        deliveryEnabled: true,
        storeHours: (merchant.storeHours as object) || ALWAYS_OPEN,
        status: "active",
        syncApiKey: merchant.syncApiKey || syncApiKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchant.id));
    console.log(`Demo merchant ensured open: ${merchant.email} (slug=${merchant.slug || slug})`);
  }

  const existingCats = await db.query.categories.findMany({
    where: eq(schema.categories.merchantId, merchant.id),
    limit: 1,
  });
  if (existingCats.length > 0) {
    console.log("Demo catalog already present");
  } else {
    const catFood = (
      await db
        .insert(schema.categories)
        .values({
          merchantId: merchant.id,
          name: "Food",
          sortOrder: 1,
          color: "#F97316",
          clientId: "cat-food",
        })
        .returning()
    )[0]!;

    const catDrinks = (
      await db
        .insert(schema.categories)
        .values({
          merchantId: merchant.id,
          name: "Drinks",
          sortOrder: 2,
          color: "#0EA5E9",
          clientId: "cat-drinks",
        })
        .returning()
    )[0]!;

    await db.insert(schema.products).values([
      {
        merchantId: merchant.id,
        categoryId: catFood.id,
        name: "Cheeseburger",
        description: "Beef patty, cheese, house sauce",
        price: "12.50",
        stock: 100,
        isActive: true,
        isTaxable: true,
        clientId: "prod-burger",
        sku: "BURGER-01",
      },
      {
        merchantId: merchant.id,
        categoryId: catFood.id,
        name: "Fries",
        description: "Crispy fries",
        price: "5.00",
        stock: 100,
        isActive: true,
        isTaxable: true,
        clientId: "prod-fries",
        sku: "FRIES-01",
      },
      {
        merchantId: merchant.id,
        categoryId: catDrinks.id,
        name: "Cola",
        description: "0.33L",
        price: "3.50",
        stock: 100,
        isActive: true,
        isTaxable: true,
        clientId: "prod-cola",
        sku: "COLA-01",
      },
    ]);

    console.log("Seeded demo categories + products");
  }

  await seedDemoInventoryBundle(merchant.id);
  await seedDemoDeliveryStaff(merchant.id);
}

async function seedDemoInventoryBundle(merchantId: string) {
  if (process.env.SEED_DEMO_INVENTORY === "false") {
    console.log("SEED_DEMO_INVENTORY=false — skipping demo inventory");
    return;
  }

  const { writeInventoryAddonEnabled } = await import("../lib/inventory-addon");
  await writeInventoryAddonEnabled(merchantId, true);

  const db = getDb();
  const { DemoCatalogService } = await import("../services/demo-catalog.service");
  const { DemoInventoryService } = await import("../services/demo-inventory.service");

  const demoProd = await db.query.products.findFirst({
    where: and(
      eq(schema.products.merchantId, merchantId),
      like(schema.products.clientId, "demo-prod-%")
    ),
  });

  if (!demoProd) {
    try {
      const catResult = await DemoCatalogService.importDemo(merchantId, {
        mode: "merge",
        force: true,
      });
      console.log(
        `Seeded demo café catalog: ${catResult.productsCreated} products, ${catResult.categoriesCreated} categories`
      );
    } catch (err) {
      console.warn("Demo catalog import skipped:", err instanceof Error ? err.message : err);
    }
  }

  try {
    if (!(await DemoInventoryService.hasDemoData(merchantId))) {
      const inv = await DemoInventoryService.importDemo(merchantId);
      console.log(
        `Seeded demo inventory: ${inv.itemsCreated} items, ${inv.recipesCreated} recipe lines, ${inv.stockMovementsCreated} movements`
      );
    } else {
      console.log("Demo inventory already present");
    }
  } catch (err) {
    console.warn("Demo inventory import skipped:", err instanceof Error ? err.message : err);
  }
}

async function seedDemoDeliveryStaff(merchantId: string) {
  if (process.env.SEED_DEMO_DELIVERY === "false") {
    console.log("SEED_DEMO_DELIVERY=false — skipping demo delivery drivers");
    return;
  }

  const db = getDb();
  const baseLat = 47.3769;
  const baseLng = 8.5417;

  if (!merchantId) return;

  await db
    .update(schema.merchants)
    .set({
      latitude: String(baseLat),
      longitude: String(baseLng),
      updatedAt: new Date(),
    })
    .where(eq(schema.merchants.id, merchantId));

  const { StaffService } = await import("../services/staff.service");
  const { DeliveryTrackingService } = await import("../services/delivery-tracking.service");
  await StaffService.ensureDefaultRoles(merchantId);

  const deliveryRole = await db.query.merchantRoles.findFirst({
    where: and(eq(schema.merchantRoles.merchantId, merchantId), eq(schema.merchantRoles.name, "Delivery")),
  });
  if (!deliveryRole) return;

  const existing = await db.query.merchantStaff.findMany({
    where: and(
      eq(schema.merchantStaff.merchantId, merchantId),
      eq(schema.merchantStaff.roleId, deliveryRole.id)
    ),
  });

  const drivers: Array<{ staffId: string; lat: number; lng: number }> = [];
  const demoNames = ["Alex (demo driver)", "Sam (demo driver)"];

  for (let i = 0; i < demoNames.length; i++) {
    const name = demoNames[i]!;
    let staff = existing.find((s) => s.name === name);
    if (!staff) {
      try {
        staff = await StaffService.createStaff(merchantId, {
          name,
          roleId: deliveryRole.id,
          pin: String(4000 + i),
        });
        console.log(`Seeded demo delivery driver ${name} (PIN ${4000 + i})`);
      } catch (err) {
        console.warn(`Demo driver ${name} skipped:`, err instanceof Error ? err.message : err);
        continue;
      }
    }
    drivers.push({
      staffId: staff.id,
      lat: baseLat + 0.006 * (i + 1),
      lng: baseLng + 0.005 * (i + 1),
    });
  }

  if (drivers.length) {
    await DeliveryTrackingService.seedDemoDriverLocations(merchantId, drivers);
    console.log(`Seeded ${drivers.length} demo delivery driver map positions`);
  }
}

async function seedEditionsAndReseller() {
  const { EditionService } = await import("../services/edition.service");
  const { ResellerService } = await import("../services/reseller.service");
  await EditionService.ensureDefaults();
  const agency = await ResellerService.ensureChaslayAgency();
  console.log("Seeded editions + agency reseller:", agency.email);
}

async function seed() {
  await seedSuperadmin();
  await SubscriptionPlansService.ensureDefaults();
  const { SubscriptionAddonsService } = await import("@/services/subscription-addons.service");
  await SubscriptionAddonsService.ensureDefaults();
  await seedEditionsAndReseller();
  await seedDemoShop();
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
