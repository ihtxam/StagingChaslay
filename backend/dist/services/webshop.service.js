"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebShopService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const web_order_number_1 = require("@/lib/web-order-number");
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
class WebShopService {
    /**
     * Get public merchant shop info
     */
    static async getShopInfo(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            return {
                id: merchant.id,
                name: merchant.name,
                address: merchant.address,
                city: merchant.city,
                country: merchant.country,
                phone: merchant.phone,
                email: merchant.email,
            };
        }
        catch (error) {
            console.error("Error getting shop info:", error);
            throw error;
        }
    }
    /**
     * Get public products for web shop
     */
    static async getPublicProducts(merchantId, page = 1, limit = 20, categoryId, search) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [
                (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
                (0, drizzle_orm_1.gt)(db_1.schema.products.stock, 0), // Only show in-stock products
            ];
            if (categoryId) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.products.categoryId, categoryId));
            }
            if (search) {
                whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.products.name, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.products.description, `%${search}%`)));
            }
            const products = await db.query.products.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                with: {
                    category: true,
                },
                limit,
                offset,
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.sortOrder), (0, drizzle_orm_1.desc)(db_1.schema.products.createdAt)],
            });
            return products;
        }
        catch (error) {
            console.error("Error getting public products:", error);
            throw error;
        }
    }
    /**
     * Get public categories
     */
    static async getPublicCategories(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const categories = await db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.desc)(db_1.schema.categories.createdAt)],
            });
            return categories;
        }
        catch (error) {
            console.error("Error getting public categories:", error);
            throw error;
        }
    }
    /**
     * Create web shop order
     */
    static async createWebShopOrder(merchantId, items, customerEmail, customerPhone, customerName, shippingAddress, notes, fulfillmentChannel = "delivery") {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant)
                throw new Error("Merchant not found");
            const taxRate = merchant_settings_service_1.MerchantSettingsService.channelTaxRate(merchant, fulfillmentChannel);
            let subtotal = 0;
            let taxAmount = 0;
            const orderItems = [];
            for (const item of items) {
                const product = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
                });
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`);
                }
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}`);
                }
                const unitPrice = parseFloat(product.price.toString());
                const itemTotal = unitPrice * item.quantity;
                const lineTax = product.isTaxable ? (itemTotal * taxRate) / 100 : 0;
                subtotal += itemTotal;
                taxAmount += lineTax;
                orderItems.push({
                    productId: item.productId,
                    productName: product.name,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice: itemTotal,
                    taxAmount: lineTax,
                });
            }
            const total = subtotal + taxAmount;
            let customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, customerEmail)),
            });
            if (!customer) {
                const newCustomer = await db
                    .insert(db_1.schema.customers)
                    .values({
                    merchantId,
                    email: customerEmail,
                    phone: customerPhone,
                    firstName: customerName?.split(" ")[0],
                    lastName: customerName?.split(" ").slice(1).join(" ") || undefined,
                    loyaltyPoints: 0,
                    totalSpent: "0",
                })
                    .returning();
                customer = newCustomer[0];
            }
            const orderNumber = await (0, web_order_number_1.generateWebOrderNumber)(db, merchantId);
            const order = await db
                .insert(db_1.schema.orders)
                .values({
                merchantId,
                orderNumber,
                customerId: customer.id,
                orderType: "web_shop",
                fulfillmentChannel,
                status: "pending",
                subtotal: subtotal.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                discountAmount: "0",
                total: total.toFixed(2),
                paymentMethod: "online",
                paymentStatus: "pending",
                notes,
                shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
            })
                .returning();
            for (const item of orderItems) {
                await db.insert(db_1.schema.orderItems).values({
                    orderId: order[0].id,
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity.toString(),
                    unitPrice: item.unitPrice.toFixed(2),
                    totalPrice: item.totalPrice.toFixed(2),
                    taxAmount: item.taxAmount.toFixed(2),
                });
            }
            return order[0];
        }
        catch (error) {
            console.error("Error creating web shop order:", error);
            throw error;
        }
    }
    /**
     * Get web shop orders
     */
    static async getWebShopOrders(merchantId, page = 1, limit = 20, status) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [
                (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
                (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop"),
            ];
            if (status) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.orders.status, status));
            }
            const orders = await db.query.orders.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                    customer: true,
                },
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt),
            });
            return orders;
        }
        catch (error) {
            console.error("Error getting web shop orders:", error);
            throw error;
        }
    }
    /**
     * Update order shipping status
     */
    static async updateShippingStatus(merchantId, orderId, shippingStatus) {
        const db = (0, db_1.getDb)();
        try {
            // Map shipping status onto order status for POS visibility
            const statusMap = {
                pending: "pending",
                processing: "pending",
                shipped: "completed",
                delivered: "completed",
            };
            const order = await db
                .update(db_1.schema.orders)
                .set({
                status: statusMap[shippingStatus] || "pending",
                notes: `shipping:${shippingStatus}`,
                completedAt: shippingStatus === "delivered" || shippingStatus === "shipped" ? new Date() : undefined,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)))
                .returning();
            if (order.length === 0) {
                throw new Error("Order not found");
            }
            return order[0];
        }
        catch (error) {
            console.error("Error updating shipping status:", error);
            throw error;
        }
    }
    /**
     * Get web shop analytics
     */
    static async getWebShopAnalytics(merchantId, startDate, endDate) {
        const db = (0, db_1.getDb)();
        try {
            let whereConditions = [
                (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
                (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop"),
            ];
            if (startDate && endDate) {
                whereConditions.push((0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, startDate));
                whereConditions.push((0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, endDate));
            }
            const orders = await db.query.orders.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
            });
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total.toString()), 0);
            const completedOrders = orders.filter((o) => o.status === "completed").length;
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            const byStatus = orders.reduce((acc, o) => {
                acc[o.status] = (acc[o.status] || 0) + 1;
                return acc;
            }, {});
            return {
                totalOrders,
                completedOrders,
                totalRevenue,
                averageOrderValue,
                byStatus,
            };
        }
        catch (error) {
            console.error("Error getting web shop analytics:", error);
            throw error;
        }
    }
    /**
     * Sync web shop order to POS
     */
    static async syncOrderToPOS(merchantId, orderId) {
        const db = (0, db_1.getDb)();
        try {
            const order = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop")),
                with: {
                    items: true,
                },
            });
            if (!order) {
                throw new Error("Order not found");
            }
            // Mark as synced
            const syncedOrder = await db
                .update(db_1.schema.orders)
                .set({
                syncedToPOS: true,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
                .returning();
            return syncedOrder[0];
        }
        catch (error) {
            console.error("Error syncing order to POS:", error);
            throw error;
        }
    }
}
exports.WebShopService = WebShopService;
//# sourceMappingURL=webshop.service.js.map