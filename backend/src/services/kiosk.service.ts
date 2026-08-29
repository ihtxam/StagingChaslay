import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { filterCatalogForChannel } from "@/lib/catalog-visibility";
import { readKioskAddonEnabled } from "@/lib/kiosk-addon";
import {
  ensureKioskAddonColumn,
  ensureKioskSettingsColumn,
  queryRaw,
} from "@/lib/ensure-merchant-schema";
import { normalizeKioskSettings, type KioskSettings } from "@/lib/kiosk-settings";
import { AdyenTerminalPoiService } from "@/services/adyen-terminal-poi.service";
import { FloorPlanService } from "@/services/floor-plan.service";
import { GiftCardService } from "@/services/gift-card.service";

export class KioskLicenseError extends Error {
  code = "KIOSK_ADDON_REQUIRED";
  constructor() {
    super("Self-order kiosk addon is not enabled for this merchant");
  }
}

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  shop_enabled?: boolean;
  shopEnabled?: boolean;
  kiosk_settings?: unknown;
  kioskSettings?: unknown;
};

async function loadMerchantByToken(token: string): Promise<{
  merchant: MerchantRow;
  settings: KioskSettings;
}> {
  await ensureKioskAddonColumn();
  await ensureKioskSettingsColumn();
  const rows = await queryRaw<MerchantRow>(
    `SELECT id, name, slug, shop_enabled, kiosk_settings
     FROM merchants
     WHERE kiosk_settings IS NOT NULL
       AND kiosk_settings->>'accessToken' = $1
     LIMIT 1`,
    [token]
  );
  const merchant = rows[0];
  if (!merchant) throw new Error("Kiosk not found");
  const enabled = await readKioskAddonEnabled(merchant.id);
  if (!enabled) throw new KioskLicenseError();
  const settings = normalizeKioskSettings(merchant.kiosk_settings);
  if (settings.accessToken !== token) throw new Error("Kiosk not found");
  return { merchant, settings };
}

export class KioskService {
  static async getPublicConfig(token: string) {
    const { merchant, settings } = await loadMerchantByToken(token);
    const shopEnabled = merchant.shop_enabled ?? merchant.shopEnabled;
    if (!shopEnabled) throw new Error("Shop is not enabled for this merchant");

    let tables: Array<{ id: string; label: string }> = [];
    try {
      const list = await FloorPlanService.listTablesForSync(merchant.id);
      tables = list.map((t) => ({ id: t.id, label: t.label || t.id }));
    } catch {
      tables = [];
    }

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
      },
      settings: {
        name: settings.name,
        promoSlides: settings.promoSlides || [],
        enabledLanguages: settings.enabledLanguages || ["en"],
        defaultLanguage: settings.defaultLanguage || "en",
        tableMode: settings.tableMode || "both",
        membershipScanEnabled: settings.membershipScanEnabled !== false,
        idleTimeoutSeconds: settings.idleTimeoutSeconds ?? 120,
        locationSlug: settings.locationSlug,
      },
      tables,
    };
  }

  static async getMenu(token: string) {
    const { merchant, settings } = await loadMerchantByToken(token);
    const db = getDb();
    const catalogChannel = "kiosk" as const;

    const { LocationsService } = await import("@/services/locations.service");
    let locationId: string | null = null;
    if (settings.locationSlug) {
      try {
        const resolved = await LocationsService.resolveBySlug(merchant.id, settings.locationSlug);
        locationId = resolved?.id ?? (await LocationsService.getDefaultId(merchant.id));
      } catch {
        locationId = await LocationsService.getDefaultId(merchant.id);
      }
    } else {
      locationId = await LocationsService.getDefaultId(merchant.id);
    }

    const [categories, products] = await Promise.all([
      db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchant.id),
        orderBy: [asc(schema.categories.sortOrder)],
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchant.id), eq(schema.products.isActive, true)),
        orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
      }),
    ]);

    const { CatalogLocationService } = await import("@/services/catalog-location.service");
    const { HqMenuService } = await import("@/services/hq-menu.service");
    const withOverrides = await CatalogLocationService.applyLocationOverrides(
      merchant.id,
      locationId,
      products
    );
    const filtered = filterCatalogForChannel(withOverrides, categories, catalogChannel);
    const menuProductIds = await HqMenuService.resolveActiveProductIds(
      merchant.id,
      locationId,
      catalogChannel
    );
    const visibleProducts = CatalogLocationService.filterByHqMenuProductIds(
      filtered.products,
      menuProductIds
    );
    const categoryIdsWithProducts = new Set(
      visibleProducts.map((p) => p.categoryId).filter(Boolean) as string[]
    );
    const visibleCategories = filtered.categories.filter(
      (c) => categoryIdsWithProducts.has(c.id) || c.isOffersCategory
    );

    const { ModifierService } = await import("@/services/modifier.service");
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchant.id,
      visibleProducts.map((p) => p.id)
    );

    const serializeGroup = (g: {
      id: string;
      title: string;
      selectionType?: string | null;
      minSelectable?: number | null;
      maxSelectable?: number | null;
      pricingType?: string | null;
      options?: Array<{
        id: string;
        name: string;
        price?: number | string | null;
        isDefault?: boolean | null;
        saleStatus?: string | null;
      }>;
    }) => ({
      id: g.id,
      title: g.title,
      selectionType: g.selectionType || "optional",
      minSelectable: Number(g.minSelectable) || 0,
      maxSelectable: Number(g.maxSelectable) || 1,
      pricingType: g.pricingType || "paid",
      options: (g.options || [])
        .filter((o) => o.saleStatus !== "out_of_stock")
        .map((o) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price) || 0,
          isDefault: !!o.isDefault,
        })),
    });

    const menu = visibleCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      items: visibleProducts
        .filter((p) => p.categoryId === cat.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          description: p.description || undefined,
          image: (p as { imageUrl?: string | null }).imageUrl || undefined,
          modifierGroups: (groupsByProduct.get(p.id) || []).map(serializeGroup),
        })),
    }));

    return { menu, locationId };
  }

  static async lookupMembership(token: string, code: string) {
    const { merchant } = await loadMerchantByToken(token);
    const card = await GiftCardService.lookup(merchant.id, code);
    return card;
  }

  static async payOrderAtTerminal(token: string, orderId: string) {
    const { merchant, settings } = await loadMerchantByToken(token);
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchant.id)),
    });
    if (!order) throw new Error("Order not found");
    if (order.orderSource !== "kiosk") throw new Error("Not a kiosk order");
    const amount = Number(order.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid order total");

    const result = await AdyenTerminalPoiService.processTerminalPayment(merchant.id, amount, {
      terminalId: settings.terminalId || undefined,
      currency: "CHF",
    });

    if (result.status !== "approved") {
      throw new Error(result.errorMessage || "Terminal payment declined");
    }

    const autoAccept = settings.kioskAutoAcceptCard !== false;
    await db
      .update(schema.orders)
      .set({
        paymentStatus: "paid",
        paymentMethod: "card",
        status: autoAccept ? "preparing" : "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    return {
      approved: true,
      reference: result.reference,
      customerReceipt: result.customerReceipt ?? null,
    };
  }

  static async readSettingsForMerchant(merchantId: string): Promise<KioskSettings> {
    await ensureKioskSettingsColumn();
    const rows = await queryRaw<{ kiosk_settings: unknown }>(
      `SELECT kiosk_settings FROM merchants WHERE id = $1 LIMIT 1`,
      [merchantId]
    );
    if (rows[0]?.kiosk_settings == null) {
      const defaults = normalizeKioskSettings(null);
      const db = getDb();
      await db
        .update(schema.merchants)
        .set({ kioskSettings: defaults, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
      return defaults;
    }
    return normalizeKioskSettings(rows[0]?.kiosk_settings);
  }

  static async writeSettingsForMerchant(merchantId: string, raw: unknown): Promise<KioskSettings> {
    await ensureKioskSettingsColumn();
    const existing = await this.readSettingsForMerchant(merchantId);
    const incoming = normalizeKioskSettings({ ...existing, ...(raw as object) });
    incoming.accessToken = existing.accessToken || incoming.accessToken;
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ kioskSettings: incoming, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return incoming;
  }

  static async regenerateToken(merchantId: string): Promise<KioskSettings> {
    const settings = await this.readSettingsForMerchant(merchantId);
    settings.accessToken = normalizeKioskSettings({}).accessToken;
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ kioskSettings: settings, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return settings;
  }

  static validateTokenForMerchant(merchantId: string, token: string): boolean {
    return String(token || "").trim().length > 0;
  }

  static async assertTokenForMerchant(merchantId: string, token: string) {
    const settings = await this.readSettingsForMerchant(merchantId);
    if (settings.accessToken !== String(token || "").trim()) {
      throw new Error("Invalid kiosk token");
    }
    const enabled = await readKioskAddonEnabled(merchantId);
    if (!enabled) throw new KioskLicenseError();
    return settings;
  }
}
