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
class CustomerService {
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
                whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.customers.email, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.customers.phone, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.customers.firstName, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.customers.lastName, `%${search}%`)));
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
}
exports.CustomerService = CustomerService;
//# sourceMappingURL=customer.service.js.map