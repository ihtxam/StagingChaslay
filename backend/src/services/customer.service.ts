import { getDb, schema } from "@/db";
import { eq, and, desc, or, ilike, sql } from "drizzle-orm";

function cleanOptional(value?: string | null) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function splitGuestName(name?: string | null): { firstName: string | null; lastName: string | null } {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return {
    firstName: parts[0].slice(0, 100),
    lastName: parts.slice(1).join(" ").slice(0, 100) || null,
  };
}

function phoneDigits(value?: string | null): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 15) : null;
}

export type GuestCustomerInput = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
};

export class CustomerService {
  /**
   * Upsert a merchant customer from an online order, shop reservation, or POS booking.
   * Matches phone (digits) first, then email. Fills missing contact/address fields.
   */
  static async upsertFromGuest(merchantId: string, input: GuestCustomerInput) {
    const db = getDb();
    const mail = cleanOptional(input.email)?.toLowerCase() || null;
    const telRaw = cleanOptional(input.phone);
    const tel = telRaw ? phoneDigits(telRaw) || telRaw.replace(/\D/g, "").slice(0, 15) || null : null;
    const split = splitGuestName(input.name);
    const first = cleanOptional(input.firstName) || split.firstName;
    const last = cleanOptional(input.lastName) || split.lastName;
    const address = cleanOptional(input.address);
    const zip = cleanOptional(input.zip);
    const city = cleanOptional(input.city);

    if (!first && !last && !mail && !tel) return null;

    let existing: typeof schema.customers.$inferSelect | undefined;
    if (tel) {
      existing = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.merchantId, merchantId),
          or(
            eq(schema.customers.phone, tel),
            eq(schema.customers.phone, telRaw || tel),
            sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') = ${tel}`
          )
        ),
        orderBy: desc(schema.customers.updatedAt),
      });
    }
    if (!existing && mail) {
      existing = await db.query.customers.findFirst({
        where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, mail)),
      });
    }

    if (existing) {
      const patch: Partial<typeof schema.customers.$inferInsert> = { updatedAt: new Date() };
      if (mail && !existing.email) patch.email = mail;
      if (tel && (!existing.phone || existing.phone.replace(/\D/g, "") !== tel)) patch.phone = tel;
      if (first && !existing.firstName) patch.firstName = first;
      if (last && !existing.lastName) patch.lastName = last;
      if (address) patch.defaultAddress = address;
      if (zip) patch.defaultZip = zip;
      if (city) patch.defaultCity = city;
      if (Object.keys(patch).length <= 1) return existing;
      const [updated] = await db
        .update(schema.customers)
        .set(patch)
        .where(eq(schema.customers.id, existing.id))
        .returning();
      return updated || existing;
    }

    try {
      const [created] = await db
        .insert(schema.customers)
        .values({
          merchantId,
          email: mail,
          phone: tel,
          firstName: first,
          lastName: last,
          defaultAddress: address,
          defaultZip: zip,
          defaultCity: city,
          loyaltyPoints: 0,
          totalSpent: "0",
        })
        .returning();
      return created;
    } catch (error) {
      console.warn("Customer upsert create failed:", error);
      return null;
    }
  }

  /**
   * Create customer
   */
  static async createCustomer(
    merchantId: string,
    email?: string,
    phone?: string,
    firstName?: string,
    lastName?: string,
    extra?: {
      defaultAddress?: string | null;
      defaultZip?: string | null;
      defaultCity?: string | null;
    }
  ) {
    const db = getDb();

    try {
      const first = cleanOptional(firstName);
      const last = cleanOptional(lastName);
      const mail = cleanOptional(email);
      let tel = cleanOptional(phone);
      if (tel) {
        const digits = tel.replace(/\D/g, "");
        if (!/^\d{1,15}$/.test(digits) || digits !== tel) {
          throw new Error("Phone number must be digits only (max 15)");
        }
        tel = digits;
      }
      if (!first && !last && !mail && !tel) {
        throw new Error("Name, email, or phone is required");
      }

      const customer = await db
        .insert(schema.customers)
        .values({
          merchantId,
          email: mail,
          phone: tel,
          firstName: first,
          lastName: last,
          defaultAddress: cleanOptional(extra?.defaultAddress),
          defaultZip: cleanOptional(extra?.defaultZip),
          defaultCity: cleanOptional(extra?.defaultCity),
          loyaltyPoints: 0,
          totalSpent: "0",
        })
        .returning();

      return customer[0];
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
    }
  }

  /**
   * Get all customers for merchant
   */
  static async getCustomers(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    search?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.customers.merchantId, merchantId)];

      if (search) {
        const q = `%${search.trim()}%`;
        const digits = search.replace(/\D/g, "");
        whereConditions.push(
          or(
            ilike(schema.customers.email, q),
            ilike(schema.customers.phone, q),
            ilike(schema.customers.firstName, q),
            ilike(schema.customers.lastName, q),
            sql`(${schema.customers.firstName} || ' ' || coalesce(${schema.customers.lastName}, '')) ilike ${q}`,
            digits.length >= 3
              ? sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
              : sql`false`
          )
        );
      }

      const customers = await db.query.customers.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        limit,
        offset,
        orderBy: desc(schema.customers.createdAt),
      });

      return customers;
    } catch (error) {
      console.error("Error getting customers:", error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      return customer;
    } catch (error) {
      console.error("Error getting customer:", error);
      throw error;
    }
  }

  /**
   * Get customer by email
   */
  static async getCustomerByEmail(merchantId: string, email: string) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.merchantId, merchantId),
          eq(schema.customers.email, email)
        ),
      });

      return customer;
    } catch (error) {
      console.error("Error getting customer by email:", error);
      throw error;
    }
  }

  /**
   * Update customer
   */
  static async updateCustomer(
    merchantId: string,
    customerId: string,
    updates: Partial<typeof schema.customers.$inferInsert>
  ) {
    const db = getDb();

    try {
      const customer = await db
        .update(schema.customers)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.customers.id, customerId),
            eq(schema.customers.merchantId, merchantId)
          )
        )
        .returning();

      if (customer.length === 0) {
        throw new Error("Customer not found");
      }

      return customer[0];
    } catch (error) {
      console.error("Error updating customer:", error);
      throw error;
    }
  }

  /**
   * Delete customer
   */
  static async deleteCustomer(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const result = await db
        .delete(schema.customers)
        .where(
          and(
            eq(schema.customers.id, customerId),
            eq(schema.customers.merchantId, merchantId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error("Customer not found");
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  }

  /**
   * Add loyalty points
   */
  static async addLoyaltyPoints(merchantId: string, customerId: string, points: number) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      const updatedCustomer = await db
        .update(schema.customers)
        .set({
          loyaltyPoints: customer.loyaltyPoints + points,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      return updatedCustomer[0];
    } catch (error) {
      console.error("Error adding loyalty points:", error);
      throw error;
    }
  }

  /**
   * Redeem loyalty points
   */
  static async redeemLoyaltyPoints(merchantId: string, customerId: string, points: number) {
    const db = getDb();

    try {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.merchantId, merchantId)
        ),
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.loyaltyPoints < points) {
        throw new Error("Insufficient loyalty points");
      }

      const updatedCustomer = await db
        .update(schema.customers)
        .set({
          loyaltyPoints: customer.loyaltyPoints - points,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      return updatedCustomer[0];
    } catch (error) {
      console.error("Error redeeming loyalty points:", error);
      throw error;
    }
  }

  /**
   * Get customer purchase history
   */
  static async getCustomerPurchaseHistory(merchantId: string, customerId: string) {
    const db = getDb();

    try {
      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.customerId, customerId)
        ),
        with: {
          items: {
            with: {
              product: true,
            },
          },
        },
        orderBy: desc(schema.orders.createdAt),
      });

      const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
      const orderCount = orders.length;

      return {
        customer: await this.getCustomerById(merchantId, customerId),
        orders,
        statistics: {
          totalSpent,
          orderCount,
          averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
        },
      };
    } catch (error) {
      console.error("Error getting purchase history:", error);
      throw error;
    }
  }

  /**
   * Get top customers by spending
   */
  static async getTopCustomers(merchantId: string, limit: number = 10) {
    const db = getDb();

    try {
      const customers = await db.query.customers.findMany({
        where: eq(schema.customers.merchantId, merchantId),
        orderBy: desc(schema.customers.totalSpent),
        limit,
      });

      return customers;
    } catch (error) {
      console.error("Error getting top customers:", error);
      throw error;
    }
  }

  /**
   * Get customer statistics
   */
  static async getCustomerStatistics(merchantId: string) {
    const db = getDb();

    try {
      const customers = await db.query.customers.findMany({
        where: eq(schema.customers.merchantId, merchantId),
      });

      const totalCustomers = customers.length;
      const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
      const totalSpent = customers.reduce((sum, c) => sum + parseFloat(c.totalSpent.toString()), 0);

      return {
        totalCustomers,
        totalLoyaltyPoints,
        totalSpent,
        averageCustomerValue: totalCustomers > 0 ? totalSpent / totalCustomers : 0,
      };
    } catch (error) {
      console.error("Error getting customer statistics:", error);
      throw error;
    }
  }

  /**
   * Compact lookup for reservation / POS autocomplete (name, phone, last party size).
   */
  static async searchForAutocomplete(merchantId: string, query: string, limit = 8) {
    const q = String(query || "").trim();
    if (q.length < 2) return [];
    const customers = await this.getCustomers(merchantId, 1, Math.min(20, limit), q);
    const db = getDb();
    const out = [];
    for (const c of customers) {
      let lastPartySize: number | null = null;
      try {
        const lastRes = await db.query.reservations.findFirst({
          where: and(
            eq(schema.reservations.merchantId, merchantId),
            c.id
              ? or(
                  eq(schema.reservations.customerId, c.id),
                  c.phone ? eq(schema.reservations.guestPhone, c.phone) : sql`false`
                )
              : sql`false`
          ),
          orderBy: desc(schema.reservations.reservedAt),
          columns: { partySize: true },
        });
        if (lastRes?.partySize) lastPartySize = Number(lastRes.partySize) || null;
      } catch {
        /* ignore */
      }
      out.push({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        defaultAddress: c.defaultAddress,
        defaultZip: c.defaultZip,
        defaultCity: c.defaultCity,
        lastPartySize,
      });
    }
    return out;
  }
}
