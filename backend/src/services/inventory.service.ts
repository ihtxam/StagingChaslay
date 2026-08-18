import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { EmailService } from "@/services/email.service";

export const INVENTORY_UNITS = ["kg", "L", "piece"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

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
  if (u === "L" || u === "l" || u === "lt") return "L";
  if (u === "piece" || u === "pcs" || u === "pc" || u === "unité") return "piece";
  return "kg";
}

function qtyStr(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

export class InventoryLicenseError extends Error {
  constructor(message = "Restaurant inventory addon is not enabled") {
    super(message);
    this.name = "InventoryLicenseError";
  }
}

export class InventoryService {
  static async getLicense(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        id: true,
        name: true,
        inventoryAddonEnabled: true,
        inventoryWasteFactor: true,
        inventoryAutoReorderEmailEnabled: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");
    return {
      enabled: merchant.inventoryAddonEnabled === true,
      wasteFactor: clampWasteFactor(merchant.inventoryWasteFactor),
      autoReorderEmailEnabled: merchant.inventoryAutoReorderEmailEnabled === true,
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
    updates: { wasteFactor?: number; autoReorderEmailEnabled?: boolean }
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
      with: { supplier: true },
      orderBy: [asc(schema.inventoryItems.name)],
    });
    return rows.map((row) => this.serializeItem(row));
  }

  static serializeItem(row: typeof schema.inventoryItems.$inferSelect & {
    supplier?: typeof schema.inventorySuppliers.$inferSelect | null;
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
      unit?: string;
      cost?: number;
      onHand?: number;
      minStock?: number;
      reorderQty?: number;
      supplierId?: string | null;
      perishable?: boolean;
      autoReorderEnabled?: boolean;
    }
  ) {
    await this.assertLicensed(merchantId);
    const name = String(input.name || "").trim().slice(0, 255);
    if (!name) throw new Error("Item name is required");
    const db = getDb();
    const supplierId = await this.assertSupplier(merchantId, input.supplierId);
    const [row] = await db
      .insert(schema.inventoryItems)
      .values({
        merchantId,
        name,
        unit: normalizeUnit(input.unit),
        cost: qtyStr(Math.max(0, num(input.cost))),
        onHand: qtyStr(Math.max(0, num(input.onHand))),
        minStock: qtyStr(Math.max(0, num(input.minStock))),
        reorderQty: qtyStr(Math.max(0, num(input.reorderQty))),
        supplierId,
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
      unit?: string;
      cost?: number;
      minStock?: number;
      reorderQty?: number;
      supplierId?: string | null;
      perishable?: boolean;
      autoReorderEnabled?: boolean;
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
    if (input.unit !== undefined) patch.unit = normalizeUnit(input.unit);
    if (input.cost !== undefined) patch.cost = qtyStr(Math.max(0, num(input.cost)));
    if (input.minStock !== undefined) patch.minStock = qtyStr(Math.max(0, num(input.minStock)));
    if (input.reorderQty !== undefined) patch.reorderQty = qtyStr(Math.max(0, num(input.reorderQty)));
    if (input.supplierId !== undefined) {
      patch.supplierId = await this.assertSupplier(merchantId, input.supplierId);
    }
    if (input.perishable !== undefined) patch.perishable = !!input.perishable;
    if (input.autoReorderEnabled !== undefined) patch.autoReorderEnabled = !!input.autoReorderEnabled;
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
    input: { qty: number; unitCost?: number; note?: string; supplierName?: string; date?: string }
  ) {
    await this.assertLicensed(merchantId);
    const qty = num(input.qty);
    if (!(qty > 0)) throw new Error("Quantity must be greater than 0");
    return this.applyMovement(merchantId, itemId, {
      type: "in",
      qty,
      unitCost: input.unitCost,
      note: input.note,
      supplierName: input.supplierName,
    });
  }

  static async waste(
    merchantId: string,
    itemId: string,
    input: { qty: number; note?: string }
  ) {
    await this.assertLicensed(merchantId);
    const qty = num(input.qty);
    if (!(qty > 0)) throw new Error("Quantity must be greater than 0");
    return this.applyMovement(merchantId, itemId, { type: "waste", qty, note: input.note });
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
      columns: { id: true, name: true },
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
      product,
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

  static async setRecipe(
    merchantId: string,
    productId: string,
    lines: Array<{ itemId: string; qty: number; unit?: string }>
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

      const productIds = [
        ...new Set(
          (order.items || [])
            .map((i) => i.productId)
            .filter((id): id is string => !!id)
        ),
      ];
      if (!productIds.length) return { deducted: false, reason: "no_products" };

      const recipes = await db.query.productRecipes.findMany({
        where: and(
          eq(schema.productRecipes.merchantId, merchantId),
          inArray(schema.productRecipes.productId, productIds)
        ),
      });
      if (!recipes.length) return { deducted: false, reason: "no_recipes" };

      const factor = 1 + license.wasteFactor;
      const usage = new Map<string, number>();
      for (const line of order.items || []) {
        if (!line.productId) continue;
        const lineQty = num(line.quantity);
        if (!(lineQty > 0)) continue;
        for (const rec of recipes.filter((r) => r.productId === line.productId)) {
          const add = num(rec.qty) * lineQty * factor;
          usage.set(rec.itemId, (usage.get(rec.itemId) || 0) + add);
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
    }
  ) {
    if (!input.skipLicense) await this.assertLicensed(merchantId);
    const item = await this.getOwnedItem(merchantId, itemId);
    const prev = num(item.onHand);
    const signed = input.type === "in" || input.type === "adjust" ? input.qty : -input.qty;
    const next = Math.round((prev + signed) * 10000) / 10000;
    const db = getDb();
    await db.insert(schema.inventoryMovements).values({
      merchantId,
      itemId,
      type: input.type,
      qty: qtyStr(Math.abs(input.qty)),
      unitCost: input.unitCost != null ? qtyStr(Math.max(0, num(input.unitCost))) : null,
      note: input.note ? String(input.note).slice(0, 500) : null,
      supplierName: input.supplierName ? String(input.supplierName).slice(0, 255) : null,
      orderId: input.orderId || null,
    });
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
    return this.serializeItem({ ...(updated || item), supplier: null });
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
