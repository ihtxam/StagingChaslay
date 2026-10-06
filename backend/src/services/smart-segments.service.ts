import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema, type SmartSegmentsSettings, type SmartSegmentRule } from "@/db";
import { ensureCustomerCrmTagsColumn, ensureSmartSegmentsAddonColumn } from "@/lib/ensure-merchant-schema";
import { merchantHasSmartSegmentsLicense } from "@/lib/smart-segments-addon";
import { isCountableSale } from "@/services/pos-reports.service";

function normalizeTag(raw: string) {
  return String(raw || "")
    .trim()
    .slice(0, 40);
}

export function normalizeSmartSegments(raw: SmartSegmentsSettings | null | undefined): SmartSegmentsSettings {
  const rulesIn = Array.isArray(raw?.rules) ? raw!.rules : [];
  const rules: SmartSegmentRule[] = rulesIn
    .map((r: SmartSegmentRule) => {
      const type = r?.type;
      if (type !== "min_lifetime_spend" && type !== "min_orders" && type !== "lapsed_days") return null;
      const threshold = Math.max(0, Number(r.threshold) || 0);
      const tag = normalizeTag(r.tag || "");
      if (!tag) return null;
      return {
        id: String(r.id || randomUUID()).slice(0, 64),
        tag,
        type,
        threshold,
        enabled: r.enabled !== false,
      };
    })
    .filter(Boolean) as SmartSegmentRule[];

  return {
    rules,
    lastAppliedAt: raw?.lastAppliedAt ? String(raw.lastAppliedAt) : null,
  };
}

function mergeTags(existing: unknown, add: string[]) {
  const base: string[] = Array.isArray(existing)
    ? existing.map((t) => normalizeTag(String(t))).filter(Boolean)
    : [];
  for (const t of add) {
    if (!base.includes(t)) base.push(t);
    if (base.length >= 20) break;
  }
  return base;
}

export class SmartSegmentsService {
  static async getSettings(merchantId: string) {
    await ensureSmartSegmentsAddonColumn();
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { smartSegmentsSettings: true },
    });
    return normalizeSmartSegments(merchant?.smartSegmentsSettings);
  }

  static async updateSettings(merchantId: string, raw: SmartSegmentsSettings) {
    await ensureSmartSegmentsAddonColumn();
    const prev = await this.getSettings(merchantId);
    const next = normalizeSmartSegments({ ...raw, lastAppliedAt: prev.lastAppliedAt });
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ smartSegmentsSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async apply(merchantId: string) {
    if (!(await merchantHasSmartSegmentsLicense(merchantId))) {
      throw new Error("Smart segments requires the Smart Segments add-on");
    }
    await ensureCustomerCrmTagsColumn();
    const settings = await this.getSettings(merchantId);
    const active = settings.rules.filter((r) => r.enabled);
    if (!active.length) {
      return { updated: 0, matched: 0, lastAppliedAt: settings.lastAppliedAt || null };
    }

    const db = getDb();
    const customers = await db.query.customers.findMany({
      where: eq(schema.customers.merchantId, merchantId),
      columns: {
        id: true,
        crmTags: true,
        totalSpent: true,
        lastOrderAt: true,
      },
    });

    const ids = customers.map((c) => c.id);
    const orderCounts = new Map<string, number>();
    if (ids.length) {
      const orders = await db.query.orders.findMany({
        where: and(eq(schema.orders.merchantId, merchantId), inArray(schema.orders.customerId, ids)),
        columns: { customerId: true, status: true, paymentStatus: true },
      });
      for (const o of orders) {
        if (!o.customerId || !isCountableSale(o)) continue;
        orderCounts.set(o.customerId, (orderCounts.get(o.customerId) || 0) + 1);
      }
    }

    const now = Date.now();
    let updated = 0;
    for (const c of customers) {
      const tagsToAdd: string[] = [];
      const spend = Number(c.totalSpent) || 0;
      const orders = orderCounts.get(c.id) || 0;
      const last = c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0;
      const daysSince = last ? (now - last) / 86_400_000 : 9999;

      for (const rule of active) {
        if (rule.type === "min_lifetime_spend" && spend >= rule.threshold) tagsToAdd.push(rule.tag);
        if (rule.type === "min_orders" && orders >= rule.threshold) tagsToAdd.push(rule.tag);
        if (rule.type === "lapsed_days" && daysSince >= rule.threshold && orders > 0) {
          tagsToAdd.push(rule.tag);
        }
      }
      if (!tagsToAdd.length) continue;
      const merged = mergeTags(c.crmTags, tagsToAdd);
      await db
        .update(schema.customers)
        .set({ crmTags: merged, updatedAt: new Date() })
        .where(eq(schema.customers.id, c.id));
      updated += 1;
    }

    const lastAppliedAt = new Date().toISOString();
    await db
      .update(schema.merchants)
      .set({
        smartSegmentsSettings: { ...settings, lastAppliedAt },
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return { updated, matched: customers.length, lastAppliedAt };
  }

  /** Preview counts per rule without writing tags. */
  static async preview(merchantId: string) {
    if (!(await merchantHasSmartSegmentsLicense(merchantId))) {
      throw new Error("Smart segments requires the Smart Segments add-on");
    }
    const settings = await this.getSettings(merchantId);
    const db = getDb();
    const rows = await db
      .select({
        id: schema.customers.id,
        totalSpent: schema.customers.totalSpent,
        lastOrderAt: schema.customers.lastOrderAt,
      })
      .from(schema.customers)
      .where(eq(schema.customers.merchantId, merchantId));

    const previews = [];
    for (const rule of settings.rules.filter((r) => r.enabled)) {
      let count = 0;
      if (rule.type === "min_lifetime_spend") {
        count = rows.filter((r) => Number(r.totalSpent) >= rule.threshold).length;
      } else if (rule.type === "lapsed_days") {
        const cutoff = new Date(Date.now() - rule.threshold * 86_400_000);
        count = rows.filter((r) => r.lastOrderAt && new Date(r.lastOrderAt) <= cutoff).length;
      } else if (rule.type === "min_orders") {
        const sub = await db.execute(sql`
          SELECT customer_id, COUNT(*)::int AS c FROM orders
          WHERE merchant_id = ${merchantId} AND customer_id IS NOT NULL
          GROUP BY customer_id HAVING COUNT(*) >= ${rule.threshold}
        `);
        const list = Array.isArray(sub) ? sub : (sub as { rows?: unknown[] }).rows || [];
        count = list.length;
      }
      previews.push({ ruleId: rule.id, tag: rule.tag, type: rule.type, threshold: rule.threshold, count });
    }
    return { rules: settings.rules, previews, lastAppliedAt: settings.lastAppliedAt || null };
  }
}
