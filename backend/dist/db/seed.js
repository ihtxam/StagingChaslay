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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const drizzle_orm_1 = require("drizzle-orm");
const index_1 = require("./index");
const auth_service_1 = require("../services/auth.service");
const chaslay_compat_service_1 = require("../services/chaslay-compat.service");
const subscription_plans_service_1 = require("../services/subscription-plans.service");
dotenv_1.default.config();
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
const DEFAULT_SUPERADMIN_NAME = "Chaslay Admin";
function resolveSuperadminName(raw) {
    const name = (raw || "").trim();
    if (!name || /manupos|chaslayreborn\s+admin/i.test(name))
        return DEFAULT_SUPERADMIN_NAME;
    return name;
}
async function renameLeftoverSuperadminLabels(db) {
    const rows = await db
        .select({ id: index_1.schema.superadmins.id, name: index_1.schema.superadmins.name })
        .from(index_1.schema.superadmins);
    for (const row of rows) {
        if (!row.name || !/manupos|chaslayreborn\s+admin/i.test(row.name))
            continue;
        await db
            .update(index_1.schema.superadmins)
            .set({ name: DEFAULT_SUPERADMIN_NAME, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(index_1.schema.superadmins.id, row.id));
        console.log(`Renamed leftover superadmin label to ${DEFAULT_SUPERADMIN_NAME}: ${row.id}`);
    }
}
async function seedSuperadmin() {
    const email = process.env.SEED_SUPERADMIN_EMAIL || "admin@chaslay.com";
    const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMeNow!123";
    const name = resolveSuperadminName(process.env.SEED_SUPERADMIN_NAME);
    const db = (0, index_1.getDb)();
    const existing = await db
        .select()
        .from(index_1.schema.superadmins)
        .where((0, drizzle_orm_1.eq)(index_1.schema.superadmins.email, email))
        .limit(1);
    if (existing.length > 0) {
        // Keep password in sync with SEED_SUPERADMIN_PASSWORD so deploys can recover lockouts
        if (password && password !== "replace-with-strong-admin-password") {
            const passwordHash = await auth_service_1.AuthService.hashPassword(password);
            await db
                .update(index_1.schema.superadmins)
                .set({ passwordHash, name, isActive: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(index_1.schema.superadmins.id, existing[0].id));
            console.log(`Superadmin password synced from SEED_SUPERADMIN_PASSWORD: ${email}`);
        }
        else {
            console.log(`Superadmin already exists: ${email}`);
        }
        await renameLeftoverSuperadminLabels(db);
        return;
    }
    const superadmin = await auth_service_1.AuthService.registerSuperadmin(email, password, name);
    console.log("Seeded superadmin:", superadmin.email);
    await renameLeftoverSuperadminLabels(db);
}
async function seedDemoShop() {
    if (process.env.SEED_DEMO_SHOP === "false") {
        console.log("SEED_DEMO_SHOP=false — skipping demo merchant");
        return;
    }
    const db = (0, index_1.getDb)();
    const email = process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@chaslay.com";
    const password = process.env.SEED_DEMO_MERCHANT_PASSWORD || "DemoShop123!";
    const slug = process.env.SEED_DEMO_SLUG || "demo";
    // Keep Android BuildConfig SYNC_API_KEY working when present
    const syncApiKey = process.env.SEED_DEMO_SYNC_API_KEY || "ihtsham_76875hgf755rjgkjh7zrzrhvjhv";
    let merchant = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(index_1.schema.merchants.slug, slug),
    });
    if (!merchant) {
        const byEmail = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(index_1.schema.merchants.email, email),
        });
        if (byEmail) {
            merchant = byEmail;
        }
    }
    if (!merchant) {
        const passwordHash = await auth_service_1.AuthService.hashPassword(password);
        const inserted = await db
            .insert(index_1.schema.merchants)
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
            syncApiKey: syncApiKey || (0, chaslay_compat_service_1.generateSyncApiKey)(),
            vatRate: "8.10",
            taxTakeawayRate: "8.10",
            taxDineInRate: "8.10",
            taxDeliveryRate: "8.10",
            panelLanguage: "en",
        })
            .returning();
        merchant = inserted[0];
        console.log(`Seeded demo merchant: ${merchant.email} (slug=${slug})`);
        console.log(`  Shop: https://shop.chaslay.com/${slug} or /shop/${slug}`);
        console.log(`  Sync API key: ${merchant.syncApiKey}`);
    }
    else {
        await db
            .update(index_1.schema.merchants)
            .set({
            shopEnabled: true,
            slug: merchant.slug || slug,
            subdomain: merchant.subdomain || slug,
            pickupEnabled: true,
            dineInEnabled: true,
            deliveryEnabled: true,
            storeHours: merchant.storeHours || ALWAYS_OPEN,
            status: "active",
            syncApiKey: merchant.syncApiKey || syncApiKey,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(index_1.schema.merchants.id, merchant.id));
        console.log(`Demo merchant ensured open: ${merchant.email} (slug=${merchant.slug || slug})`);
    }
    const existingCats = await db.query.categories.findMany({
        where: (0, drizzle_orm_1.eq)(index_1.schema.categories.merchantId, merchant.id),
        limit: 1,
    });
    if (existingCats.length > 0) {
        console.log("Demo catalog already present");
    }
    else {
        const catFood = (await db
            .insert(index_1.schema.categories)
            .values({
            merchantId: merchant.id,
            name: "Food",
            sortOrder: 1,
            color: "#F97316",
            clientId: "cat-food",
        })
            .returning())[0];
        const catDrinks = (await db
            .insert(index_1.schema.categories)
            .values({
            merchantId: merchant.id,
            name: "Drinks",
            sortOrder: 2,
            color: "#0EA5E9",
            clientId: "cat-drinks",
        })
            .returning())[0];
        await db.insert(index_1.schema.products).values([
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
async function seedDemoInventoryBundle(merchantId) {
    if (process.env.SEED_DEMO_INVENTORY === "false") {
        console.log("SEED_DEMO_INVENTORY=false — skipping demo inventory");
        return;
    }
    const { writeInventoryAddonEnabled } = await Promise.resolve().then(() => __importStar(require("../lib/inventory-addon")));
    await writeInventoryAddonEnabled(merchantId, true);
    const db = (0, index_1.getDb)();
    const { DemoCatalogService } = await Promise.resolve().then(() => __importStar(require("../services/demo-catalog.service")));
    const { DemoInventoryService } = await Promise.resolve().then(() => __importStar(require("../services/demo-inventory.service")));
    const demoProd = await db.query.products.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.like)(index_1.schema.products.clientId, "demo-prod-%")),
    });
    if (!demoProd) {
        try {
            const catResult = await DemoCatalogService.importDemo(merchantId, {
                mode: "merge",
                force: true,
            });
            console.log(`Seeded demo café catalog: ${catResult.productsCreated} products, ${catResult.categoriesCreated} categories`);
        }
        catch (err) {
            console.warn("Demo catalog import skipped:", err instanceof Error ? err.message : err);
        }
    }
    try {
        if (!(await DemoInventoryService.hasDemoData(merchantId))) {
            const inv = await DemoInventoryService.importDemo(merchantId);
            console.log(`Seeded demo inventory: ${inv.itemsCreated} items, ${inv.recipesCreated} recipe lines, ${inv.stockMovementsCreated} movements`);
        }
        else {
            console.log("Demo inventory already present");
        }
    }
    catch (err) {
        console.warn("Demo inventory import skipped:", err instanceof Error ? err.message : err);
    }
}
async function seedDemoDeliveryStaff(merchantId) {
    if (process.env.SEED_DEMO_DELIVERY === "false") {
        console.log("SEED_DEMO_DELIVERY=false — skipping demo delivery drivers");
        return;
    }
    const db = (0, index_1.getDb)();
    const baseLat = 47.3769;
    const baseLng = 8.5417;
    if (!merchantId)
        return;
    await db
        .update(index_1.schema.merchants)
        .set({
        latitude: String(baseLat),
        longitude: String(baseLng),
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(index_1.schema.merchants.id, merchantId));
    const { StaffService } = await Promise.resolve().then(() => __importStar(require("../services/staff.service")));
    const { DeliveryTrackingService } = await Promise.resolve().then(() => __importStar(require("../services/delivery-tracking.service")));
    await StaffService.ensureDefaultRoles(merchantId);
    const deliveryRole = await db.query.merchantRoles.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_1.schema.merchantRoles.merchantId, merchantId), (0, drizzle_orm_1.eq)(index_1.schema.merchantRoles.name, "Delivery")),
    });
    if (!deliveryRole)
        return;
    const existing = await db.query.merchantStaff.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(index_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(index_1.schema.merchantStaff.roleId, deliveryRole.id)),
    });
    const drivers = [];
    const demoNames = ["Alex (demo driver)", "Sam (demo driver)"];
    for (let i = 0; i < demoNames.length; i++) {
        const name = demoNames[i];
        let staff = existing.find((s) => s.name === name);
        if (!staff) {
            try {
                staff = await StaffService.createStaff(merchantId, {
                    name,
                    roleId: deliveryRole.id,
                    pin: String(4000 + i),
                });
                console.log(`Seeded demo delivery driver ${name} (PIN ${4000 + i})`);
            }
            catch (err) {
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
    const { EditionService } = await Promise.resolve().then(() => __importStar(require("../services/edition.service")));
    const { ResellerService } = await Promise.resolve().then(() => __importStar(require("../services/reseller.service")));
    await EditionService.ensureDefaults();
    const agency = await ResellerService.ensureChaslayAgency();
    console.log("Seeded editions + agency reseller:", agency.email);
}
async function seed() {
    await seedSuperadmin();
    await subscription_plans_service_1.SubscriptionPlansService.ensureDefaults();
    await seedEditionsAndReseller();
    await seedDemoShop();
}
seed()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map