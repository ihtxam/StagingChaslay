import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { EmailService } from "@/services/email.service";
import {
  ensureInventoryAddonColumn,
  withMerchantSchemaRetry,
} from "@/lib/ensure-merchant-schema";
import { isInventoryAddonEnabled, readInventoryAddonEnabled } from "@/lib/inventory-addon";

export const INVENTORY_UNITS = ["kg", "g", "L", "ml", "piece", "pack"] as const;
export type InventoryUnit = string;

const DEFAULT_UNITS: Array<{ code: string; name: string }> = [
  { code: "kg", name: "Kilogram" },
  { code: "g", name: "Gram" },
  { code: "L", name: "Liter" },
  { code: "ml", name: "Milliliter" },
  { code: "piece", name: "Piece" },
  { code: "pack", name: "Pack" },
];

const DEFAULT_RATIOS: Array<{ fromCode: string; toCode: string; factor: number }> = [
  { fromCode: "kg", toCode: "g", factor: 1000 },
  { fromCode: "L", toCode: "ml", factor: 1000 },
];

const AUTO_REORDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampWasteFactor(raw: unknown): number {
  const n = num(raw, 0.2);
  if (n < 0) return 0;
  if (n > 0.5) return 0.5;
  return Math.round(n * 10000) / 10000;
}

function normalizeUnit(raw?: string | null): InventoryUnit {
  const u = String(raw || "").trim();
  if (!u) return "kg";
  const key = u.toLowerCase();
  const aliases: Record<string, string> = {
    l: "L",
    lt: "L",
    liter: "L",
    litre: "L",
    ml: "ml",
    milliliter: "ml",
    kg: "kg",
    kilo: "kg",
    g: "g",
    gram: "g",
    grams: "g",
    piece: "piece",
    pcs: "piece",
    pc: "piece",
    unité: "piece",
    pack: "pack",
    can: "can",
    box: "box",
  };
  if (aliases[key]) return aliases[key];
  return u.slice(0, 20);
}

function qtyStr(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

function clampRecipeYield(raw: unknown): number {
  const n = num(raw, 1);
  if (!(n > 0)) return 1;
  if (n > 10000) return 10000;
  return Math.round(n * 10000) / 10000;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(raw?: string | null): raw is string {
  return !!raw && UUID_RE.test(raw);
}

function clampExpiryAlertDays(raw: unknown): number {
  const n = Math.round(num(raw, 30));
  if (n < 1) return 1;
  if (n > 365) return 365;
  return n;
}

function parseExpiryDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export class InventoryLicenseError extends Error {
  constructor(message = "Restaurant inventory addon is not enabled") {
    super(message);
    this.name = "InventoryLicenseError";
  }
}

export class InventoryService {
  static async getLicense(merchantId: string) {
    await ensureInventoryAddonColumn();
    const db = getDb();
    const merchant = await withMerchantSchemaRetry(() =>
      db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: {
          id: true,
          name: true,
          inventoryAddonEnabled: true,
          inventoryWasteFactor: true,
          inventoryAutoReorderEmailEnabled: true,
          inventoryExpiryAlertDays: true,
        },
      })
    );
    if (!merchant) throw new Error("Merchant not found");
    const enabled = await readInventoryAddonEnabled(merchantId).catch(() =>
      isInventoryAddonEnabled(merchant.inventoryAddonEnabled)
    );
    return {
      enabled,
      inventoryAddonEnabled: enabled,
      inventoryEnabled: enabled,
      wasteFactor: clampWasteFactor(merchant.inventoryWasteFactor),
      autoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
      expiryAlertDays: clampExpiryAlertDays(merchant.inventoryExpiryAlertDays),
      merchantName: merchant.name,
    };
  }

  static async assertLicensed(merchantId: string) {
    const license = await this.getLicense(merchantId);
    if (!license.enabled) throw new InventoryLicenseError();
    return license;
  }

  static async updateSettings(
    merchantId: string,
    updates: { wasteFactor?: number; autoReorderEmailEnabled?: boolean; expiryAlertDays?: number }
  ) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.wasteFactor !== undefined) {
      patch.inventoryWasteFactor = clampWasteFactor(updates.wasteFactor).toFixed(4);
    }
    if (updates.autoReorderEmailEnabled !== undefined) {
      patch.inventoryAutoReorderEmailEnabled = !!updates.autoReorderEmailEnabled;
    }
    if (updates.expiryAlertDays !== undefined) {
      patch.inventoryExpiryAlertDays = clampExpiryAlertDays(updates.expiryAlertDays);
    }
    await db.update(schema.merchants).set(patch).where(eq(schema.merchants.id, merchantId));
    return this.getLicense(merchantId);
  }

  // ---------------------------------------------------------------------------
  // Suppliers (first-class CRUD)
  // ---------------------------------------------------------------------------

  static async listSuppliers(merchantId: string, opts?: { includeArchived?: boolean }) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const rows = await db.query.inventorySuppliers.findMany({
      where: eq(schema.inventorySuppliers.merchantId, merchantId),
      orderBy: [desc(schema.inventorySuppliers.updatedAt)],
    });
    const visible = opts?.includeArchived ? rows : rows.filter((s) => !s.archivedAt);
    const ids = visible.map((s) => s.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const grouped = await db
        .select({
          supplierId: schema.inventoryItems.supplierId,
          c: sql<number>`count(*)::int`,
        })
        .from(schema.inventoryItems)
        .where(
          and(
            eq(schema.inventoryItems.merchantId, merchantId),
            inArray(schema.inventoryItems.supplierId, ids)
          )
        )
        .groupBy(schema.inventoryItems.supplierId);
      for (const g of grouped) {
        if (g.supplierId) counts.set(g.supplierId, Number(g.c) || 0);
      }
    }
    return visible.map((s) => ({
      ...s,
      linkedItemCount: counts.get(s.id) || 0,
    }));
  }

  static async getSupplier(merchantId: string, supplierId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const supplier = await db.query.inventorySuppliers.findFirst({
      where: and(
        eq(schema.inventorySuppliers.id, supplierId),
        eq(schema.inventorySuppliers.merchantId, merchantId)
      ),
    });
    if (!supplier) throw new Error("Supplier not found");
    const items = await db.query.inventoryItems.findMany({
      where: and(
        eq(schema.inventoryItems.merchantId, merchantId),
        eq(schema.inventoryItems.supplierId, supplierId)
      ),
      orderBy: [asc(schema.inventoryItems.name)],
    });
    return { supplier, items };
  }

  static async createSupplier(
    merchantId: string,
    input: {
      name: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      contactPerson?: string | null;
      notes?: string | null;
    }
  ) {
    await this.assertLicensed(merchantId);
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Supplier name is required");
    const db = getDb();
    const [row] = await db
      .insert(schema.inventorySuppliers)
      .values({
        merchantId,
        name,
        email: input.email ? String(input.email).trim().slice(0, 255) : null,
        phone: input.phone ? String(input.phone).trim().slice(0, 40) : null,
        address: input.address ? String(input.address).trim().slice(0, 2000) : null,
        contactPerson: input.contactPerson ? String(input.contactPerson).trim().slice(0, 255) : null,
        notes: input.notes ? String(input.notes).trim().slice(0, 4000) : null,
      })
      .returning();
    return row;
  }

  static async updateSupplier(
    merchantId: string,
    supplierId: string,
    input: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      contactPerson?: string | null;
      notes?: string | null;
    }
  ) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const existing = await db.query.inventorySuppliers.findFirst({
      where: and(
        eq(schema.inventorySuppliers.id, supplierId),
        eq(schema.inventorySuppliers.merchantId, merchantId)
      ),
    });
    if (!existing) throw new Error("Supplier not found");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const name = String(input.name || "").trim().slice(0, 255);
      if (!name) throw new Error("Supplier name is required");
      patch.name = name;
    }
    if (input.email !== undefined) {
      patch.email = input.email ? String(input.email).trim().slice(0, 255) : null;
    }
    if (input.phone !== undefined) {
      patch.phone = input.phone ? String(input.phone).trim().slice(0, 40) : null;
    }
    if (input.address !== undefined) {
      patch.address = input.address ? String(input.address).trim().slice(0, 2000) : null;
    }
    if (input.contactPerson !== undefined) {
      patch.contactPerson = input.contactPerson
        ? String(input.contactPerson).trim().slice(0, 255)
        : null;
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes ? String(input.notes).trim().slice(0, 4000) : null;
    }
    const [row] = await db
      .update(schema.inventorySuppliers)
      .set(patch)
      .where(eq(schema.inventorySuppliers.id, supplierId))
      .returning();
    return row;
  }

  static async deleteSupplier(merchantId: string, supplierId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const existing = await db.query.inventorySuppliers.findFirst({
      where: and(
        eq(schema.inventorySuppliers.id, supplierId),
        eq(schema.inventorySuppliers.merchantId, merchantId)
      ),
    });
    if (!existing) throw new Error("Supplier not found");
    const linked = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.merchantId, merchantId),
        eq(schema.inventoryItems.supplierId, supplierId)
      ),
      columns: { id: true },
    });
    if (linked) {
      const [row] = await db
        .update(schema.inventorySuppliers)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.inventorySuppliers.id, supplierId))
        .returning();
      return { supplier: row, softDeleted: true };
    }
    await db
      .delete(schema.inventorySuppliers)
      .where(
        and(
          eq(schema.inventorySuppliers.id, supplierId),
          eq(schema.inventorySuppliers.merchantId, merchantId)
        )
      );
    return { supplier: existing, softDeleted: false };
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  static async listItems(merchantId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const rows = await db.query.inventoryItems.findMany({
      where: eq(schema.inventoryItems.merchantId, merchantId),
      with: { supplier: true, category: true },
      orderBy: [asc(schema.inventoryItems.name)],
    });
    return rows.map((row) => this.serializeItem(row));
  }

  static serializeItem(row: typeof schema.inventoryItems.$inferSelect & {
    supplier?: typeof schema.inventorySuppliers.$inferSelect | null;
    category?: typeof schema.inventoryCategories.$inferSelect | null;
  }) {
    const onHand = num(row.onHand);
    const minStock = num(row.minStock);
    return {
      ...row,
      onHand,
      minStock,
      reorderQty: num(row.reorderQty),
      cost: num(row.cost),
      lowStock: minStock > 0 && onHand <= minStock,
      outOfStock: onHand <= 0,
      categoryId: row.categoryId || null,
      category: row.category
        ? { id: row.category.id, name: row.category.name }
        : null,
      supplier: row.supplier
        ? {
            id: row.supplier.id,
            name: row.supplier.name,
            email: row.supplier.email,
            archivedAt: row.supplier.archivedAt,
          }
        : null,
    };
  }

  static async createItem(
    merchantId: string,
    input: {
      name: string;
      barcode?: string | null;
      unit?: string;
      cost?: number;
      onHand?: number;
      minStock?: number;
      reorderQty?: number;
      supplierId?: string | null;
      perishable?: boolean;
      autoReorderEnabled?: boolean;
      categoryId?: string | null;
    }
  ) {
    await this.assertLicensed(merchantId);
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Item name is required");
    const barcode = input.barcode != null ? String(input.barcode).trim().slice(0, 255) || null : null;
    if (barcode) await this.assertBarcodeAvailable(merchantId, barcode);
    const db = getDb();
    const supplierId = await this.assertSupplier(merchantId, input.supplierId);
    const categoryId = await this.assertCategory(merchantId, input.categoryId);
    const [row] = await db
      .insert(schema.inventoryItems)
      .values({
        merchantId,
        name,
        barcode,
        unit: normalizeUnit(input.unit),
        cost: qtyStr(Math.max(0, num(input.cost))),
        onHand: qtyStr(Math.max(0, num(input.onHand))),
        minStock: qtyStr(Math.max(0, num(input.minStock))),
        reorderQty: qtyStr(Math.max(0, num(input.reorderQty))),
        supplierId,
        categoryId,
        perishable: !!input.perishable,
        autoReorderEnabled: !!input.autoReorderEnabled,
      })
      .returning();
    if (num(input.onHand) > 0) {
      await db.insert(schema.inventoryMovements).values({
        merchantId,
        itemId: row.id,
        type: "in",
        qty: qtyStr(num(input.onHand)),
        unitCost: qtyStr(Math.max(0, num(input.cost))),
        note: "Opening stock",
      });
    }
    await this.maybeAutoReorder(merchantId, [row.id], num(input.onHand), num(input.onHand));
    return this.serializeItem({ ...row, supplier: null });
  }

  static async updateItem(
    merchantId: string,
    itemId: string,
    input: {
      name?: string;
      barcode?: string | null;
      unit?: string;
      cost?: number;
      minStock?: number;
      reorderQty?: number;
      supplierId?: string | null;
      perishable?: boolean;
      autoReorderEnabled?: boolean;
      categoryId?: string | null;
    }
  ) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const existing = await this.getOwnedItem(merchantId, itemId);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const name = String(input.name || "").trim().slice(0, 255);
      if (!name) throw new Error("Item name is required");
      patch.name = name;
    }
    if (input.barcode !== undefined) {
      const barcode = String(input.barcode || "").trim().slice(0, 255) || null;
      if (barcode) await this.assertBarcodeAvailable(merchantId, barcode, itemId);
      patch.barcode = barcode;
    }
    if (input.unit !== undefined) patch.unit = normalizeUnit(input.unit);
    if (input.cost !== undefined) patch.cost = qtyStr(Math.max(0, num(input.cost)));
    if (input.minStock !== undefined) patch.minStock = qtyStr(Math.max(0, num(input.minStock)));
    if (input.reorderQty !== undefined) patch.reorderQty = qtyStr(Math.max(0, num(input.reorderQty)));
    if (input.supplierId !== undefined) {
      patch.supplierId = await this.assertSupplier(merchantId, input.supplierId);
    }
    if (input.perishable !== undefined) patch.perishable = !!input.perishable;
    if (input.autoReorderEnabled !== undefined) patch.autoReorderEnabled = !!input.autoReorderEnabled;
    if (input.categoryId !== undefined) {
      patch.categoryId = await this.assertCategory(merchantId, input.categoryId);
    }
    const [row] = await db
      .update(schema.inventoryItems)
      .set(patch)
      .where(eq(schema.inventoryItems.id, existing.id))
      .returning();
    return this.serializeItem({ ...row, supplier: null });
  }

  static async deleteItem(merchantId: string, itemId: string) {
    await this.assertLicensed(merchantId);
    const existing = await this.getOwnedItem(merchantId, itemId);
    const db = getDb();
    await db
      .delete(schema.inventoryItems)
      .where(
        and(eq(schema.inventoryItems.id, existing.id), eq(schema.inventoryItems.merchantId, merchantId))
      );
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Movements
  // ---------------------------------------------------------------------------

  static async stockIn(
    merchantId: string,
    itemId: string,
    input: {
      qty: number;
      unit?: string;
      unitCost?: number;
      note?: string;
      supplierName?: string;
      date?: string;
      expiryDate?: string | null;
    }
  ) {
    await this.assertLicensed(merchantId);
    const item = await this.getOwnedItem(merchantId, itemId);
    const qty = await this.toBaseQty(merchantId, num(input.qty), input.unit, item.unit);
    if (!(qty > 0)) throw new Error("Quantity must be greater than 0");
    const { item: updated, movementId } = await this.applyMovement(merchantId, itemId, {
      type: "in",
      qty,
      unitCost: input.unitCost,
      note: input.note,
      supplierName: input.supplierName,
    });
    const expiry = parseExpiryDate(input.expiryDate);
    if (expiry) {
      await this.createStockLot(merchantId, itemId, movementId, qty, expiry, input.note);
      if (!item.perishable) {
        const db = getDb();
        await db
          .update(schema.inventoryItems)
          .set({ perishable: true, updatedAt: new Date() })
          .where(eq(schema.inventoryItems.id, itemId));
      }
    }
    return updated;
  }

  static async stockOut(
    merchantId: string,
    itemId: string,
    input: { qty: number; note?: string; reason?: "waste" | "out" }
  ) {
    await this.assertLicensed(merchantId);
    const qty = num(input.qty);
    if (!(qty > 0)) throw new Error("Quantity must be greater than 0");
    const type = input.reason === "out" ? "out" : "waste";
    return this.applyMovement(merchantId, itemId, { type, qty, note: input.note }).then((r) => r.item);
  }

  static async waste(
    merchantId: string,
    itemId: string,
    input: { qty: number; note?: string }
  ) {
    return this.stockOut(merchantId, itemId, { ...input, reason: "waste" });
  }

  static async countStock(
    merchantId: string,
    itemId: string,
    input: { realQty: number; note?: string }
  ) {
    await this.assertLicensed(merchantId);
    const item = await this.getOwnedItem(merchantId, itemId);
    const realQty = Math.max(0, num(input.realQty));
    const systemQty = num(item.onHand);
    const delta = Math.round((realQty - systemQty) * 10000) / 10000;
    if (delta === 0) {
      return this.serializeItem({ ...item, supplier: null, category: null });
    }
    return this.applyMovement(merchantId, itemId, {
      type: "adjust",
      qty: Math.abs(delta),
      note: input.note || `Count: system ${systemQty} → real ${realQty}`,
      adjustSign: delta > 0 ? 1 : -1,
    }).then((r) => r.item);
  }

  static async listMovements(merchantId: string, itemId?: string, limit = 100) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const where = [eq(schema.inventoryMovements.merchantId, merchantId)];
    if (itemId) where.push(eq(schema.inventoryMovements.itemId, itemId));
    return db.query.inventoryMovements.findMany({
      where: and(...where),
      with: { item: true },
      orderBy: [desc(schema.inventoryMovements.createdAt)],
      limit: Math.min(300, Math.max(1, limit)),
    });
  }

  static async lowStock(merchantId: string) {
    await this.assertLicensed(merchantId);
    const items = await this.listItems(merchantId);
    return items.filter((i) => i.lowStock);
  }

  static async getItemByBarcode(merchantId: string, barcode: string) {
    await this.assertLicensed(merchantId);
    const code = String(barcode || "").trim();
    if (!code) return null;
    const db = getDb();
    const row = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.merchantId, merchantId),
        eq(schema.inventoryItems.barcode, code)
      ),
      with: { supplier: true, category: true },
    });
    if (!row) return null;
    return this.serializeItem(row);
  }

  static async listExpiringSoon(merchantId: string) {
    const license = await this.getLicense(merchantId);
    if (!license.enabled) return { leadDays: license.expiryAlertDays, lots: [] as Array<Record<string, unknown>> };
    const leadDays = license.expiryAlertDays;
    const horizon = new Date(Date.now() + leadDays * 24 * 60 * 60 * 1000);
    const db = getDb();
    const rows = await db.query.inventoryStockLots.findMany({
      where: and(
        eq(schema.inventoryStockLots.merchantId, merchantId),
        sql`${schema.inventoryStockLots.remainingQty}::numeric > 0`,
        sql`${schema.inventoryStockLots.expiryDate} IS NOT NULL`,
        lte(schema.inventoryStockLots.expiryDate, horizon)
      ),
      with: { item: true },
      orderBy: [asc(schema.inventoryStockLots.expiryDate)],
      limit: 200,
    });
    const now = Date.now();
    const lots = rows.map((lot) => {
      const expiryMs = lot.expiryDate ? new Date(lot.expiryDate).getTime() : 0;
      const daysLeft = expiryMs ? Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000)) : null;
      return {
        id: lot.id,
        itemId: lot.itemId,
        itemName: lot.item?.name || "",
        unit: lot.item?.unit || "piece",
        qty: num(lot.remainingQty),
        expiryDate: lot.expiryDate,
        daysLeft,
        expired: daysLeft != null && daysLeft < 0,
      };
    });
    return { leadDays, lots };
  }

  static async getStorekeeperBootstrap(merchantId: string) {
    const license = await this.getLicense(merchantId);
    if (!license.enabled) throw new InventoryLicenseError();
    const db = getDb();
    const [categories, units] = await Promise.all([
      db.query.inventoryCategories.findMany({
        where: eq(schema.inventoryCategories.merchantId, merchantId),
        orderBy: [asc(schema.inventoryCategories.name)],
      }),
      db.query.inventoryUnits.findMany({
        where: eq(schema.inventoryUnits.merchantId, merchantId),
        orderBy: [asc(schema.inventoryUnits.code)],
      }),
    ]);
    return {
      ...license,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      units: units.length
        ? units.map((u) => ({ code: u.code, name: u.name }))
        : DEFAULT_UNITS,
    };
  }

  static async storekeeperIntake(
    merchantId: string,
    input: {
      barcode: string;
      name?: string;
      unit?: string;
      categoryId?: string | null;
      qty: number;
      expiryDate?: string | null;
      cost?: number;
      note?: string;
    }
  ) {
    await this.assertLicensed(merchantId);
    const barcode = String(input.barcode || "").trim();
    if (!barcode) throw new Error("Barcode is required");
    const qty = num(input.qty);
    if (!(qty > 0)) throw new Error("Quantity must be greater than 0");

    let item = await this.getItemByBarcode(merchantId, barcode);
    let created = false;
    if (!item) {
      const name = String(input.name || "").trim();
      if (!name) throw new Error("Product name is required for new items");
      created = true;
      item = await this.createItem(merchantId, {
        name,
        barcode,
        unit: input.unit,
        categoryId: input.categoryId,
        perishable: !!parseExpiryDate(input.expiryDate),
        onHand: 0,
        cost: input.cost,
      });
    } else {
      const patch: Parameters<typeof InventoryService.updateItem>[2] = {};
      const name = String(input.name || "").trim();
      if (name && name !== item.name) patch.name = name;
      if (input.unit) patch.unit = input.unit;
      if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
      if (parseExpiryDate(input.expiryDate)) patch.perishable = true;
      if (Object.keys(patch).length) {
        item = await this.updateItem(merchantId, item.id, patch);
      }
    }

    const updated = await this.stockIn(merchantId, item.id, {
      qty,
      unit: input.unit,
      unitCost: input.cost,
      note: input.note || "Storekeeper intake",
      expiryDate: input.expiryDate,
    });
    return { item: updated, created };
  }

  private static async assertBarcodeAvailable(
    merchantId: string,
    barcode: string,
    excludeItemId?: string
  ) {
    const db = getDb();
    const existing = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.merchantId, merchantId),
        eq(schema.inventoryItems.barcode, barcode)
      ),
      columns: { id: true },
    });
    if (existing && existing.id !== excludeItemId) {
      throw new Error("Barcode already used by another stock item");
    }
  }

  private static async createStockLot(
    merchantId: string,
    itemId: string,
    movementId: string,
    qty: number,
    expiryDate: Date,
    note?: string
  ) {
    const db = getDb();
    await db.insert(schema.inventoryStockLots).values({
      merchantId,
      itemId,
      movementId,
      qty: qtyStr(qty),
      remainingQty: qtyStr(qty),
      expiryDate,
      note: note ? String(note).slice(0, 500) : null,
    });
  }

  static async usageReport(merchantId: string, days = 30) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        itemId: schema.inventoryMovements.itemId,
        type: schema.inventoryMovements.type,
        qty: sql<string>`sum(${schema.inventoryMovements.qty})`,
      })
      .from(schema.inventoryMovements)
      .where(
        and(
          eq(schema.inventoryMovements.merchantId, merchantId),
          gte(schema.inventoryMovements.createdAt, since)
        )
      )
      .groupBy(schema.inventoryMovements.itemId, schema.inventoryMovements.type);
    const items = await this.listItems(merchantId);
    const byItem = new Map<string, { sale: number; waste: number; inn: number }>();
    for (const r of rows) {
      const cur = byItem.get(r.itemId) || { sale: 0, waste: 0, inn: 0 };
      const q = num(r.qty);
      if (r.type === "sale") cur.sale += q;
      else if (r.type === "waste") cur.waste += q;
      else if (r.type === "in") cur.inn += q;
      byItem.set(r.itemId, cur);
    }
    return items.map((item) => {
      const u = byItem.get(item.id) || { sale: 0, waste: 0, inn: 0 };
      return {
        ...item,
        theoreticalUsage: u.sale,
        wasteQty: u.waste,
        stockInQty: u.inn,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Recipes
  // ---------------------------------------------------------------------------

  static async getRecipe(merchantId: string, productId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)),
      columns: { id: true, name: true, sku: true, recipeYield: true, productType: true },
    });
    if (!product) throw new Error("Product not found");
    const lines = await db.query.productRecipes.findMany({
      where: and(
        eq(schema.productRecipes.merchantId, merchantId),
        eq(schema.productRecipes.productId, productId)
      ),
      with: { item: true },
    });
    return {
      product: {
        ...product,
        recipeYield: clampRecipeYield(product.recipeYield),
      },
      recipeYield: clampRecipeYield(product.recipeYield),
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        qty: num(l.qty),
        unit: l.unit,
        itemName: l.item?.name,
        itemUnit: l.item?.unit,
      })),
    };
  }

  static async listCookbook(merchantId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: {
        id: true,
        name: true,
        sku: true,
        isActive: true,
        productType: true,
        recipeYield: true,
      },
      orderBy: [asc(schema.products.name)],
    });
    const lines = await db.query.productRecipes.findMany({
      where: eq(schema.productRecipes.merchantId, merchantId),
      with: { item: true },
    });
    const byProduct = new Map<string, typeof lines>();
    for (const line of lines) {
      const list = byProduct.get(line.productId) || [];
      list.push(line);
      byProduct.set(line.productId, list);
    }
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      isActive: p.isActive !== false,
      productType: p.productType,
      recipeYield: clampRecipeYield(p.recipeYield),
      lines: (byProduct.get(p.id) || []).map((l) => ({
        id: l.id,
        itemId: l.itemId,
        qty: num(l.qty),
        unit: l.unit,
        itemName: l.item?.name,
        itemUnit: l.item?.unit,
      })),
    }));
  }

  static async setRecipe(
    merchantId: string,
    productId: string,
    lines: Array<{ itemId: string; qty: number; unit?: string }>,
    recipeYield?: number
  ) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)),
      columns: { id: true },
    });
    if (!product) throw new Error("Product not found");
    const clean = (Array.isArray(lines) ? lines : [])
      .map((l) => ({
        itemId: String(l.itemId || ""),
        qty: num(l.qty),
        unit: normalizeUnit(l.unit),
      }))
      .filter((l) => l.itemId && l.qty > 0)
      .slice(0, 80);
    const itemIds = [...new Set(clean.map((l) => l.itemId))];
    if (itemIds.length) {
      const owned = await db.query.inventoryItems.findMany({
        where: and(
          eq(schema.inventoryItems.merchantId, merchantId),
          inArray(schema.inventoryItems.id, itemIds)
        ),
        columns: { id: true, unit: true },
      });
      const ownedSet = new Set(owned.map((o) => o.id));
      for (const id of itemIds) {
        if (!ownedSet.has(id)) throw new Error("Invalid inventory item in recipe");
      }
      const unitById = new Map(owned.map((o) => [o.id, o.unit]));
      for (const line of clean) {
        line.unit = normalizeUnit(unitById.get(line.itemId) || line.unit);
      }
    }
    await db
      .delete(schema.productRecipes)
      .where(
        and(
          eq(schema.productRecipes.merchantId, merchantId),
          eq(schema.productRecipes.productId, productId)
        )
      );
    if (clean.length) {
      await db.insert(schema.productRecipes).values(
        clean.map((l) => ({
          merchantId,
          productId,
          itemId: l.itemId,
          qty: qtyStr(l.qty),
          unit: l.unit,
        }))
      );
    }
    if (recipeYield !== undefined) {
      await db
        .update(schema.products)
        .set({ recipeYield: qtyStr(clampRecipeYield(recipeYield)), updatedAt: new Date() })
        .where(and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)));
    }
    return this.getRecipe(merchantId, productId);
  }

  // ---------------------------------------------------------------------------
  // Sale deduction (paid orders only)
  // ---------------------------------------------------------------------------

  static async deductForPaidOrder(merchantId: string, orderId: string) {
    try {
      const license = await this.getLicense(merchantId);
      if (!license.enabled) return { deducted: false, reason: "addon_off" };
      const db = getDb();
      const order = await db.query.orders.findFirst({
        where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
        with: { items: true },
      });
      if (!order) return { deducted: false, reason: "missing_order" };
      const status = String(order.status || "").toLowerCase();
      const pay = String(order.paymentStatus || "").toLowerCase();
      if (status === "cancelled") return { deducted: false, reason: "cancelled" };
      if (pay !== "completed" && pay !== "paid") return { deducted: false, reason: "unpaid" };

      const already = await db.query.inventoryMovements.findFirst({
        where: and(
          eq(schema.inventoryMovements.merchantId, merchantId),
          eq(schema.inventoryMovements.orderId, orderId),
          eq(schema.inventoryMovements.type, "sale")
        ),
        columns: { id: true },
      });
      if (already) return { deducted: false, reason: "already" };

      const extraIds: string[] = [];
      const candidateIds = new Set<string>();
      for (const line of order.items || []) {
        if (line.productId) candidateIds.add(line.productId);
        const extras = Array.isArray(line.selectedExtras) ? line.selectedExtras : [];
        for (const extra of extras) {
          if (extra?.id) extraIds.push(String(extra.id));
        }
        const combos = Array.isArray(line.comboSelections) ? line.comboSelections : [];
        for (const combo of combos) {
          if (combo?.productId) candidateIds.add(combo.productId);
          for (const extra of combo.selectedExtras || []) {
            if (extra?.id) extraIds.push(String(extra.id));
          }
        }
      }
      const productIds = [...candidateIds];
      if (!productIds.length && !extraIds.length) {
        return { deducted: false, reason: "no_products" };
      }

      const recipes = productIds.length
        ? await db.query.productRecipes.findMany({
            where: and(
              eq(schema.productRecipes.merchantId, merchantId),
              inArray(schema.productRecipes.productId, productIds)
            ),
          })
        : [];
      const yieldRows = productIds.length
        ? await db.query.products.findMany({
            where: and(
              eq(schema.products.merchantId, merchantId),
              inArray(schema.products.id, productIds)
            ),
            columns: { id: true, recipeYield: true },
          })
        : [];
      const yieldByProduct = new Map(
        yieldRows.map((p) => [p.id, clampRecipeYield(p.recipeYield)])
      );
      const recipesByProduct = new Map<string, typeof recipes>();
      for (const rec of recipes) {
        const list = recipesByProduct.get(rec.productId) || [];
        list.push(rec);
        recipesByProduct.set(rec.productId, list);
      }

      const uniqueExtraIds = [...new Set(extraIds.filter(isUuid))];
      const modifierRows = uniqueExtraIds.length
        ? await db.query.modifierOptions.findMany({
            where: inArray(schema.modifierOptions.id, uniqueExtraIds),
            with: { group: true },
          })
        : [];
      const modifierById = new Map(
        modifierRows
          .filter((o) => o.group?.merchantId === merchantId && o.inventoryItemId && num(o.inventoryQty) > 0)
          .map((o) => [o.id, o])
      );

      if (!recipes.length && !modifierById.size) {
        return { deducted: false, reason: "no_recipes" };
      }

      const factor = 1 + license.wasteFactor;
      const usage = new Map<string, number>();
      const addUsage = (itemId: string, qty: number) => {
        if (!(qty > 0) || !itemId) return;
        usage.set(itemId, (usage.get(itemId) || 0) + qty);
      };
      const consumeProduct = (productId: string, lineQty: number) => {
        const recs = recipesByProduct.get(productId);
        if (!recs?.length) return;
        const yieldQty = yieldByProduct.get(productId) || 1;
        for (const rec of recs) {
          addUsage(rec.itemId, (num(rec.qty) * lineQty * factor) / yieldQty);
        }
      };
      const consumeExtras = (
        extras: Array<{ id?: string }> | null | undefined,
        lineQty: number
      ) => {
        for (const extra of extras || []) {
          if (!extra?.id) continue;
          const opt = modifierById.get(extra.id);
          if (!opt?.inventoryItemId) continue;
          addUsage(opt.inventoryItemId, num(opt.inventoryQty) * lineQty * factor);
        }
      };

      for (const line of order.items || []) {
        const lineQty = num(line.quantity);
        if (!(lineQty > 0)) continue;
        const parentId = line.productId || "";
        const combos = Array.isArray(line.comboSelections) ? line.comboSelections : [];
        const parentHasRecipe = parentId ? recipesByProduct.has(parentId) : false;
        if (parentHasRecipe) {
          consumeProduct(parentId, lineQty);
        } else {
          for (const combo of combos) {
            if (combo?.productId) consumeProduct(combo.productId, lineQty);
          }
        }
        consumeExtras(line.selectedExtras, lineQty);
        for (const combo of combos) {
          consumeExtras(combo.selectedExtras, lineQty);
        }
      }

      const touched: string[] = [];
      for (const [itemId, qty] of usage) {
        if (!(qty > 0)) continue;
        await this.applyMovement(merchantId, itemId, {
          type: "sale",
          qty,
          orderId,
          note: `Sale ${order.orderNumber || orderId.slice(0, 8)}`,
          skipLicense: true,
          skipAutoReorder: true,
        });
        touched.push(itemId);
      }
      if (touched.length) {
        void this.maybeAutoReorder(merchantId, touched).catch((err) =>
          console.warn("[inventory] sale auto-reorder failed:", err)
        );
      }
      return { deducted: true, items: touched.length };
    } catch (err) {
      console.warn("[inventory] sale deduct failed:", err);
      return { deducted: false, reason: "error" };
    }
  }

  // ---------------------------------------------------------------------------
  // Reorder emails
  // ---------------------------------------------------------------------------

  static async sendReorderEmail(
    merchantId: string,
    opts: { itemIds?: string[]; supplierId?: string; force?: boolean }
  ) {
    const license = await this.assertLicensed(merchantId);
    const db = getDb();
    let items = await this.listItems(merchantId);
    if (opts.supplierId) {
      items = items.filter((i) => i.supplierId === opts.supplierId);
    }
    if (opts.itemIds?.length) {
      const set = new Set(opts.itemIds);
      items = items.filter((i) => set.has(i.id));
    }
    const targets = items.filter((i) => {
      if (!i.supplier?.email || i.supplier.archivedAt) return false;
      if (opts.force) return num(i.reorderQty) > 0 || i.lowStock;
      return i.lowStock && num(i.reorderQty) > 0;
    });
    if (!targets.length) throw new Error("No items to order");

    const bySupplier = new Map<string, typeof targets>();
    for (const item of targets) {
      const sid = item.supplierId!;
      const list = bySupplier.get(sid) || [];
      list.push(item);
      bySupplier.set(sid, list);
    }

    const sent: Array<{ supplierId: string; email: string; items: number }> = [];
    for (const [supplierId, list] of bySupplier) {
      const supplier = list[0]!.supplier!;
      const email = String(supplier.email || "").trim();
      if (!email) continue;
      const lines = list
        .map((i) => {
          const qty = num(i.reorderQty) > 0 ? num(i.reorderQty) : Math.max(0, num(i.minStock) - num(i.onHand));
          return `• ${i.name}: ${qty} ${i.unit} (on hand ${num(i.onHand)} ${i.unit}, par ${num(i.minStock)} ${i.unit})`;
        })
        .join("\n");
      const subject = `Purchase order request — ${license.merchantName}`;
      const text = [
        `Hello${supplier.name ? ` ${supplier.name}` : ""},`,
        "",
        `${license.merchantName} would like to order:`,
        "",
        lines,
        "",
        "Please confirm availability and delivery.",
        "",
        license.merchantName,
      ].join("\n");
      await EmailService.send({
        merchantId,
        to: email,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
        emailType: "inventory_reorder",
      });
      await db
        .update(schema.inventorySuppliers)
        .set({ lastOrderEmailAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.inventorySuppliers.id, supplierId));
      const now = new Date();
      await db
        .update(schema.inventoryItems)
        .set({ lastAutoReorderAt: now, updatedAt: now })
        .where(
          and(
            eq(schema.inventoryItems.merchantId, merchantId),
            inArray(
              schema.inventoryItems.id,
              list.map((i) => i.id)
            )
          )
        );
      sent.push({ supplierId, email, items: list.length });
    }
    return { sent };
  }

  // ---------------------------------------------------------------------------
  // Categories / units
  // ---------------------------------------------------------------------------

  static async listCategories(merchantId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    return db.query.inventoryCategories.findMany({
      where: eq(schema.inventoryCategories.merchantId, merchantId),
      orderBy: [asc(schema.inventoryCategories.name)],
    });
  }

  static async createCategory(merchantId: string, name: string) {
    await this.assertLicensed(merchantId);
    const clean = String(name || "").trim().slice(0, 100);
    if (!clean) throw new Error("Category name is required");
    const db = getDb();
    const [row] = await db
      .insert(schema.inventoryCategories)
      .values({ merchantId, name: clean })
      .returning();
    return row;
  }

  static async deleteCategory(merchantId: string, categoryId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    await db
      .update(schema.inventoryItems)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(
        and(eq(schema.inventoryItems.merchantId, merchantId), eq(schema.inventoryItems.categoryId, categoryId))
      );
    await db
      .delete(schema.inventoryCategories)
      .where(
        and(
          eq(schema.inventoryCategories.id, categoryId),
          eq(schema.inventoryCategories.merchantId, merchantId)
        )
      );
    return { ok: true };
  }

  static async listUnits(merchantId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    let units = await db.query.inventoryUnits.findMany({
      where: eq(schema.inventoryUnits.merchantId, merchantId),
      orderBy: [asc(schema.inventoryUnits.code)],
    });
    if (!units.length) {
      await db.insert(schema.inventoryUnits).values(
        DEFAULT_UNITS.map((u) => ({ merchantId, code: u.code, name: u.name }))
      );
      const existing = await db.query.inventoryUnitRatios.findMany({
        where: eq(schema.inventoryUnitRatios.merchantId, merchantId),
      });
      if (!existing.length) {
        await db.insert(schema.inventoryUnitRatios).values(
          DEFAULT_RATIOS.map((r) => ({
            merchantId,
            fromCode: r.fromCode,
            toCode: r.toCode,
            factor: qtyStr(r.factor),
          }))
        );
      }
      units = await db.query.inventoryUnits.findMany({
        where: eq(schema.inventoryUnits.merchantId, merchantId),
        orderBy: [asc(schema.inventoryUnits.code)],
      });
    }
    const ratios = await db.query.inventoryUnitRatios.findMany({
      where: eq(schema.inventoryUnitRatios.merchantId, merchantId),
      orderBy: [asc(schema.inventoryUnitRatios.fromCode)],
    });
    return {
      units,
      ratios: ratios.map((r) => ({ ...r, factor: num(r.factor) })),
    };
  }

  static async createUnit(merchantId: string, input: { code: string; name: string }) {
    await this.assertLicensed(merchantId);
    const code = normalizeUnit(input.code);
    const name = String(input.name || "").trim().slice(0, 80) || code;
    const db = getDb();
    const [row] = await db
      .insert(schema.inventoryUnits)
      .values({ merchantId, code, name })
      .returning();
    return row;
  }

  static async deleteUnit(merchantId: string, unitId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const unit = await db.query.inventoryUnits.findFirst({
      where: and(eq(schema.inventoryUnits.id, unitId), eq(schema.inventoryUnits.merchantId, merchantId)),
    });
    if (!unit) throw new Error("Unit not found");
    await db
      .delete(schema.inventoryUnitRatios)
      .where(
        and(
          eq(schema.inventoryUnitRatios.merchantId, merchantId),
          or(
            eq(schema.inventoryUnitRatios.fromCode, unit.code),
            eq(schema.inventoryUnitRatios.toCode, unit.code)
          )
        )
      );
    await db
      .delete(schema.inventoryUnits)
      .where(eq(schema.inventoryUnits.id, unit.id));
    return { ok: true };
  }

  static async createRatio(
    merchantId: string,
    input: { fromCode: string; toCode: string; factor: number }
  ) {
    await this.assertLicensed(merchantId);
    const fromCode = normalizeUnit(input.fromCode);
    const toCode = normalizeUnit(input.toCode);
    const factor = num(input.factor);
    if (fromCode === toCode) throw new Error("Units must be different");
    if (!(factor > 0)) throw new Error("Ratio must be greater than 0");
    const db = getDb();
    const [row] = await db
      .insert(schema.inventoryUnitRatios)
      .values({ merchantId, fromCode, toCode, factor: qtyStr(factor) })
      .returning();
    return { ...row, factor };
  }

  static async deleteRatio(merchantId: string, ratioId: string) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    await db
      .delete(schema.inventoryUnitRatios)
      .where(
        and(
          eq(schema.inventoryUnitRatios.id, ratioId),
          eq(schema.inventoryUnitRatios.merchantId, merchantId)
        )
      );
    return { ok: true };
  }

  static async purchaseReport(merchantId: string, days = 30) {
    await this.assertLicensed(merchantId);
    const db = getDb();
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    const rows = await db.query.inventoryMovements.findMany({
      where: and(
        eq(schema.inventoryMovements.merchantId, merchantId),
        eq(schema.inventoryMovements.type, "in"),
        gte(schema.inventoryMovements.createdAt, since)
      ),
      with: { item: true },
      orderBy: [desc(schema.inventoryMovements.createdAt)],
      limit: 500,
    });
    const byStock = new Map<string, { name: string; qty: number; cost: number }>();
    const bySupplier = new Map<string, { name: string; qty: number; cost: number }>();
    const byDate = new Map<string, { qty: number; cost: number }>();
    for (const r of rows) {
      const qty = num(r.qty);
      const cost = qty * num(r.unitCost);
      const stockName = r.item?.name || r.itemId;
      const stock = byStock.get(r.itemId) || { name: stockName, qty: 0, cost: 0 };
      stock.qty += qty;
      stock.cost += cost;
      byStock.set(r.itemId, stock);
      const supplierName = r.supplierName || "—";
      const sup = bySupplier.get(supplierName) || { name: supplierName, qty: 0, cost: 0 };
      sup.qty += qty;
      sup.cost += cost;
      bySupplier.set(supplierName, sup);
      const day = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
      const date = byDate.get(day) || { qty: 0, cost: 0 };
      date.qty += qty;
      date.cost += cost;
      byDate.set(day, date);
    }
    return {
      byStock: [...byStock.values()].sort((a, b) => b.cost - a.cost),
      bySupplier: [...bySupplier.values()].sort((a, b) => b.cost - a.cost),
      byDate: [...byDate.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private static async getOwnedItem(merchantId: string, itemId: string) {
    const db = getDb();
    const item = await db.query.inventoryItems.findFirst({
      where: and(eq(schema.inventoryItems.id, itemId), eq(schema.inventoryItems.merchantId, merchantId)),
    });
    if (!item) throw new Error("Inventory item not found");
    return item;
  }

  private static async assertCategory(merchantId: string, categoryId?: string | null) {
    if (!categoryId) return null;
    const db = getDb();
    const c = await db.query.inventoryCategories.findFirst({
      where: and(
        eq(schema.inventoryCategories.id, categoryId),
        eq(schema.inventoryCategories.merchantId, merchantId)
      ),
    });
    if (!c) throw new Error("Stock category not found");
    return c.id;
  }

  private static async toBaseQty(
    merchantId: string,
    qty: number,
    fromUnit: string | undefined,
    toUnit: string
  ) {
    const from = normalizeUnit(fromUnit || toUnit);
    const to = normalizeUnit(toUnit);
    if (from === to) return qty;
    const { ratios } = await this.listUnits(merchantId);
    const direct = ratios.find((r) => r.fromCode === from && r.toCode === to);
    if (direct) return qty * num(direct.factor);
    const inverse = ratios.find((r) => r.fromCode === to && r.toCode === from);
    if (inverse && num(inverse.factor) > 0) return qty / num(inverse.factor);
    throw new Error(`No unit ratio from ${from} to ${to}`);
  }

  private static async assertSupplier(merchantId: string, supplierId?: string | null) {
    if (!supplierId) return null;
    const db = getDb();
    const s = await db.query.inventorySuppliers.findFirst({
      where: and(
        eq(schema.inventorySuppliers.id, supplierId),
        eq(schema.inventorySuppliers.merchantId, merchantId)
      ),
    });
    if (!s || s.archivedAt) throw new Error("Supplier not found");
    return s.id;
  }

  private static async applyMovement(
    merchantId: string,
    itemId: string,
    input: {
      type: "in" | "out" | "waste" | "sale" | "adjust";
      qty: number;
      unitCost?: number;
      note?: string;
      supplierName?: string;
      orderId?: string;
      skipLicense?: boolean;
      skipAutoReorder?: boolean;
      adjustSign?: 1 | -1;
    }
  ) {
    if (!input.skipLicense) await this.assertLicensed(merchantId);
    const item = await this.getOwnedItem(merchantId, itemId);
    const prev = num(item.onHand);
    const signed =
      input.type === "adjust"
        ? input.qty * (input.adjustSign || 1)
        : input.type === "in"
          ? input.qty
          : -input.qty;
    const next = Math.round((prev + signed) * 10000) / 10000;
    const db = getDb();
    const [movement] = await db.insert(schema.inventoryMovements).values({
      merchantId,
      itemId,
      type: input.type,
      qty: qtyStr(Math.abs(input.qty)),
      unitCost: input.unitCost != null ? qtyStr(Math.max(0, num(input.unitCost))) : null,
      note: input.note ? String(input.note).slice(0, 500) : null,
      supplierName: input.supplierName ? String(input.supplierName).slice(0, 255) : null,
      orderId: input.orderId || null,
    }).returning({ id: schema.inventoryMovements.id });
    const [updated] = await db
      .update(schema.inventoryItems)
      .set({ onHand: qtyStr(next), updatedAt: new Date() })
      .where(eq(schema.inventoryItems.id, itemId))
      .returning();
    if (input.type === "in" && input.unitCost != null && num(input.unitCost) > 0) {
      await db
        .update(schema.inventoryItems)
        .set({ cost: qtyStr(Math.max(0, num(input.unitCost))) })
        .where(eq(schema.inventoryItems.id, itemId));
    }
    if (!input.skipAutoReorder) {
      void this.maybeAutoReorder(merchantId, [itemId], prev, next).catch((err) =>
        console.warn("[inventory] auto-reorder failed:", err)
      );
    }
    return { item: this.serializeItem({ ...(updated || item), supplier: null }), movementId: movement.id };
  }

  private static async maybeAutoReorder(
    merchantId: string,
    itemIds: string[],
    previousOnHand?: number,
    newOnHand?: number
  ) {
    if (!itemIds.length) return;
    const license = await this.getLicense(merchantId);
    if (!license.enabled || !license.autoReorderEmailEnabled) return;
    const db = getDb();
    const items = await db.query.inventoryItems.findMany({
      where: and(
        eq(schema.inventoryItems.merchantId, merchantId),
        inArray(schema.inventoryItems.id, itemIds)
      ),
      with: { supplier: true },
    });
    const now = Date.now();
    const due: string[] = [];
    for (const item of items) {
      const minStock = num(item.minStock);
      const onHand = num(item.onHand);
      if (minStock <= 0) continue;
      if (onHand > minStock) {
        if (item.lastAutoReorderAt) {
          await db
            .update(schema.inventoryItems)
            .set({ lastAutoReorderAt: null, updatedAt: new Date() })
            .where(eq(schema.inventoryItems.id, item.id));
        }
        continue;
      }
      if (!item.autoReorderEnabled) continue;
      if (!item.supplier?.email || item.supplier.archivedAt) continue;
      if (num(item.reorderQty) <= 0 && minStock - onHand <= 0) continue;
      const last = item.lastAutoReorderAt ? new Date(item.lastAutoReorderAt).getTime() : 0;
      const crossedBelow = previousOnHand > minStock && onHand <= minStock;
      const cooled = !last || now - last >= AUTO_REORDER_COOLDOWN_MS;
      if (crossedBelow || cooled) due.push(item.id);
    }
    if (!due.length) return;
    try {
      await this.sendReorderEmail(merchantId, { itemIds: due, force: true });
    } catch (err) {
      console.warn("[inventory] auto reorder email skipped:", err);
    }
  }
}
