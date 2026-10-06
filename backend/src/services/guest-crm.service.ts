import { getDb, schema } from "@/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { isCountableSale } from "@/services/pos-reports.service";
import { ensureCustomerCrmTagsColumn } from "@/lib/ensure-merchant-schema";

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    const s = String(t || "")
      .trim()
      .slice(0, 40);
    if (!s || out.includes(s)) continue;
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

function displayName(c: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (c.email) return c.email;
  if (c.phone) return c.phone;
  return "Guest";
}

export class GuestCrmService {
  static async listProfiles(
    merchantId: string,
    opts: { page?: number; limit?: number; search?: string }
  ) {
    await ensureCustomerCrmTagsColumn();
    const db = getDb();
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.customers.merchantId, merchantId)];
    const search = String(opts.search || "").trim();
    if (search) {
      const q = `%${search}%`;
      const digits = search.replace(/\D/g, "");
      conditions.push(
        or(
          ilike(schema.customers.email, q),
          ilike(schema.customers.phone, q),
          ilike(schema.customers.firstName, q),
          ilike(schema.customers.lastName, q),
          sql`(${schema.customers.firstName} || ' ' || coalesce(${schema.customers.lastName}, '')) ilike ${q}`,
          digits.length >= 3
            ? sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
            : sql`false`
        )!
      );
    }

    const rows = await db.query.customers.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(schema.customers.lastOrderAt), desc(schema.customers.updatedAt)],
    });

    const ids = rows.map((r) => r.id);
    const statsByCustomer = new Map<
      string,
      { orderCount: number; lastVisit: Date | null; lifetimeRevenue: number }
    >();

    if (ids.length) {
      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          inArray(schema.orders.customerId, ids)
        ),
        columns: {
          customerId: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
      });
      for (const o of orders) {
        if (!o.customerId || !isCountableSale(o)) continue;
        const cur = statsByCustomer.get(o.customerId) || {
          orderCount: 0,
          lastVisit: null,
          lifetimeRevenue: 0,
        };
        cur.orderCount += 1;
        cur.lifetimeRevenue += Number(o.total) || 0;
        const at = o.createdAt ? new Date(o.createdAt) : null;
        if (at && (!cur.lastVisit || at > cur.lastVisit)) cur.lastVisit = at;
        statsByCustomer.set(o.customerId, cur);
      }
    }

    return {
      page,
      limit,
      profiles: rows.map((c) => {
        const stats = statsByCustomer.get(c.id);
        const crmTags = normalizeTags(c.crmTags);
        return {
          id: c.id,
          name: displayName(c),
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          loyaltyPoints: c.loyaltyPoints ?? 0,
          totalSpent: Number(c.totalSpent) || 0,
          marketingOptIn: c.marketingOptIn !== false,
          lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : null,
          tags: crmTags,
          orderCount: stats?.orderCount ?? 0,
          lastVisit: stats?.lastVisit?.toISOString() ?? (c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : null),
          lifetimeRevenue: stats?.lifetimeRevenue ?? (Number(c.totalSpent) || 0),
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        };
      }),
    };
  }

  static async getProfile(merchantId: string, customerId: string) {
    await ensureCustomerCrmTagsColumn();
    const db = getDb();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!customer) throw new Error("Customer not found");

    const orders = await db.query.orders.findMany({
      where: and(eq(schema.orders.merchantId, merchantId), eq(schema.orders.customerId, customerId)),
      orderBy: desc(schema.orders.createdAt),
      limit: 20,
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        orderType: true,
        createdAt: true,
      },
    });

    const visits = orders.filter((o) => isCountableSale(o));
    return {
      profile: {
        id: customer.id,
        name: displayName(customer),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints ?? 0,
        totalSpent: Number(customer.totalSpent) || 0,
        marketingOptIn: customer.marketingOptIn !== false,
        tags: normalizeTags(customer.crmTags),
        orderCount: visits.length,
        lastVisit: visits[0]?.createdAt ? new Date(visits[0].createdAt!).toISOString() : null,
      },
      recentOrders: visits.slice(0, 15).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        total: Number(o.total) || 0,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
      })),
    };
  }

  static async updateTags(merchantId: string, customerId: string, tags: string[]) {
    await ensureCustomerCrmTagsColumn();
    const db = getDb();
    const normalized = normalizeTags(tags);
    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Customer not found");

    await db.execute(
      sql`UPDATE customers SET crm_tags = ${JSON.stringify(normalized)}::jsonb, updated_at = NOW() WHERE id = ${customerId} AND merchant_id = ${merchantId}`
    );
    return { tags: normalized };
  }
}
