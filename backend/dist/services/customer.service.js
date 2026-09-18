"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
function cleanOptional(value) {
    if (value == null)
        return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}
function splitGuestName(name) {
    const parts = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length)
        return { firstName: null, lastName: null };
    return {
        firstName: parts[0].slice(0, 100),
        lastName: parts.slice(1).join(" ").slice(0, 100) || null,
    };
}
function phoneDigits(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(0, 15) : null;
}
class CustomerService {
    /**
     * Upsert a merchant customer from an online order, shop reservation, or POS booking.
     * Matches phone (digits) first, then email. Fills missing contact/address fields.
     */
    static async upsertFromGuest(merchantId, input) {
        const db = (0, db_1.getDb)();
        const mail = cleanOptional(input.email)?.toLowerCase() || null;
        const telRaw = cleanOptional(input.phone);
        const tel = telRaw ? phoneDigits(telRaw) || telRaw.replace(/\D/g, "").slice(0, 15) || null : null;
        const split = splitGuestName(input.name);
        const first = cleanOptional(input.firstName) || split.firstName;
        const last = cleanOptional(input.lastName) || split.lastName;
        const address = cleanOptional(input.address);
        const zip = cleanOptional(input.zip);
        const city = cleanOptional(input.city);
        if (!first && !last && !mail && !tel)
            return null;
        let existing;
        if (tel) {
            existing = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.customers.phone, tel), (0, drizzle_orm_1.eq)(db_1.schema.customers.phone, telRaw || tel), (0, drizzle_orm_1.sql) `regexp_replace(coalesce(${db_1.schema.customers.phone}, ''), '[^0-9]', '', 'g') = ${tel}`)),
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.customers.updatedAt),
            });
        }
        if (!existing && mail) {
            existing = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, mail)),
            });
        }
        if (existing) {
            const patch = { updatedAt: new Date() };
            if (mail && !existing.email)
                patch.email = mail;
            if (tel && (!existing.phone || existing.phone.replace(/\D/g, "") !== tel))
                patch.phone = tel;
            if (first && !existing.firstName)
                patch.firstName = first;
            if (last && !existing.lastName)
                patch.lastName = last;
            if (address)
                patch.defaultAddress = address;
            if (zip)
                patch.defaultZip = zip;
            if (city)
                patch.defaultCity = city;
            if (Object.keys(patch).length <= 1)
                return existing;
            const [updated] = await db
                .update(db_1.schema.customers)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, existing.id))
                .returning();
            return updated || existing;
        }
        try {
            const [created] = await db
                .insert(db_1.schema.customers)
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
        }
        catch (error) {
            console.warn("Customer upsert create failed:", error);
            return null;
        }
    }
    /**
     * Create customer
     */
    static async createCustomer(merchantId, email, phone, firstName, lastName, extra) {
        const db = (0, db_1.getDb)();
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
                .insert(db_1.schema.customers)
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
        }
        catch (error) {
            console.error("Error creating customer:", error);
            throw error;
        }
    }
    /**
     * Get all customers for merchant
     */
    static async getCustomers(merchantId, page = 1, limit = 20, search) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)];
            if (search) {
                const q = `%${search.trim()}%`;
                const digits = search.replace(/\D/g, "");
                whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(db_1.schema.customers.email, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.phone, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.firstName, q), (0, drizzle_orm_1.ilike)(db_1.schema.customers.lastName, q), (0, drizzle_orm_1.sql) `(${db_1.schema.customers.firstName} || ' ' || coalesce(${db_1.schema.customers.lastName}, '')) ilike ${q}`, digits.length >= 3
                    ? (0, drizzle_orm_1.sql) `regexp_replace(coalesce(${db_1.schema.customers.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
                    : (0, drizzle_orm_1.sql) `false`));
            }
            const customers = await db.query.customers.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.customers.createdAt),
            });
            return customers;
        }
        catch (error) {
            console.error("Error getting customers:", error);
            throw error;
        }
    }
    /**
     * Get customer by ID
     */
    static async getCustomerById(merchantId, customerId) {
        const db = (0, db_1.getDb)();
        try {
            const customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
            });
            if (!customer) {
                throw new Error("Customer not found");
            }
            return customer;
        }
        catch (error) {
            console.error("Error getting customer:", error);
            throw error;
        }
    }
    /**
     * Get customer by email
     */
    static async getCustomerByEmail(merchantId, email) {
        const db = (0, db_1.getDb)();
        try {
            const customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, email)),
            });
            return customer;
        }
        catch (error) {
            console.error("Error getting customer by email:", error);
            throw error;
        }
    }
    /**
     * Update customer
     */
    static async updateCustomer(merchantId, customerId, updates) {
        const db = (0, db_1.getDb)();
        try {
            const customer = await db
                .update(db_1.schema.customers)
                .set({
                ...updates,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)))
                .returning();
            if (customer.length === 0) {
                throw new Error("Customer not found");
            }
            return customer[0];
        }
        catch (error) {
            console.error("Error updating customer:", error);
            throw error;
        }
    }
    /**
     * Delete customer
     */
    static async deleteCustomer(merchantId, customerId) {
        const db = (0, db_1.getDb)();
        try {
            const result = await db
                .delete(db_1.schema.customers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)))
                .returning();
            if (result.length === 0) {
                throw new Error("Customer not found");
            }
            return { success: true };
        }
        catch (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    }
    /**
     * Add loyalty points
     */
    static async addLoyaltyPoints(merchantId, customerId, points) {
        const db = (0, db_1.getDb)();
        try {
            const customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
            });
            if (!customer) {
                throw new Error("Customer not found");
            }
            const updatedCustomer = await db
                .update(db_1.schema.customers)
                .set({
                loyaltyPoints: customer.loyaltyPoints + points,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId))
                .returning();
            return updatedCustomer[0];
        }
        catch (error) {
            console.error("Error adding loyalty points:", error);
            throw error;
        }
    }
    /**
     * Redeem loyalty points
     */
    static async redeemLoyaltyPoints(merchantId, customerId, points) {
        const db = (0, db_1.getDb)();
        try {
            const customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
            });
            if (!customer) {
                throw new Error("Customer not found");
            }
            if (customer.loyaltyPoints < points) {
                throw new Error("Insufficient loyalty points");
            }
            const updatedCustomer = await db
                .update(db_1.schema.customers)
                .set({
                loyaltyPoints: customer.loyaltyPoints - points,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId))
                .returning();
            return updatedCustomer[0];
        }
        catch (error) {
            console.error("Error redeeming loyalty points:", error);
            throw error;
        }
    }
    /**
     * Get customer purchase history
     */
    static async getCustomerPurchaseHistory(merchantId, customerId) {
        const db = (0, db_1.getDb)();
        try {
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.customerId, customerId)),
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt),
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
        }
        catch (error) {
            console.error("Error getting purchase history:", error);
            throw error;
        }
    }
    /**
     * Get top customers by spending
     */
    static async getTopCustomers(merchantId, limit = 10) {
        const db = (0, db_1.getDb)();
        try {
            const customers = await db.query.customers.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId),
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.customers.totalSpent),
                limit,
            });
            return customers;
        }
        catch (error) {
            console.error("Error getting top customers:", error);
            throw error;
        }
    }
    /**
     * Get customer statistics
     */
    static async getCustomerStatistics(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const customers = await db.query.customers.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId),
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
        }
        catch (error) {
            console.error("Error getting customer statistics:", error);
            throw error;
        }
    }
    /**
     * Compact lookup for reservation / POS autocomplete (name, phone, last party size).
     */
    static async searchForAutocomplete(merchantId, query, limit = 8) {
        const q = String(query || "").trim();
        if (q.length < 2)
            return [];
        const customers = await this.getCustomers(merchantId, 1, Math.min(20, limit), q);
        const db = (0, db_1.getDb)();
        const out = [];
        for (const c of customers) {
            let lastPartySize = null;
            try {
                const lastRes = await db.query.reservations.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId), c.id
                        ? (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.reservations.customerId, c.id), c.phone ? (0, drizzle_orm_1.eq)(db_1.schema.reservations.guestPhone, c.phone) : (0, drizzle_orm_1.sql) `false`)
                        : (0, drizzle_orm_1.sql) `false`),
                    orderBy: (0, drizzle_orm_1.desc)(db_1.schema.reservations.reservedAt),
                    columns: { partySize: true },
                });
                if (lastRes?.partySize)
                    lastPartySize = Number(lastRes.partySize) || null;
            }
            catch {
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
exports.CustomerService = CustomerService;
//# sourceMappingURL=customer.service.js.map