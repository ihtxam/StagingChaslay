"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const db_1 = require("@/db");
const text_encoding_1 = require("@/lib/text-encoding");
const drizzle_orm_1 = require("drizzle-orm");
class ProductService {
    /**
     * Create product
     */
    static async createProduct(merchantId, name, price, categoryId, sku, barcode, cost, stock, isTaxable = true, description, imageUrl, extras) {
        const db = (0, db_1.getDb)();
        try {
            const [{ nextSort }] = await db
                .select({
                nextSort: (0, drizzle_orm_1.sql) `coalesce(${(0, drizzle_orm_1.max)(db_1.schema.products.sortOrder)}, -1) + 1`,
            })
                .from(db_1.schema.products)
                .where((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId));
            const product = await db
                .insert(db_1.schema.products)
                .values({
                merchantId,
                name: (0, text_encoding_1.repairCatalogText)(name),
                price: price.toString(),
                categoryId,
                sku,
                barcode: barcode && String(barcode).trim() ? String(barcode).trim() : null,
                cost: cost?.toString(),
                stock: stock || 0,
                isTaxable,
                description,
                imageUrl,
                productType: extras?.productType || "standard",
                isOpenPrice: !!extras?.isOpenPrice,
                soldByWeight: !!extras?.soldByWeight,
                weightUnit: extras?.weightUnit || "kg",
                bulkPricing: extras?.bulkPricing || [],
                extras: extras?.extras || [],
                comboItems: extras?.comboItems || [],
                specifications: extras?.specifications || [],
                buttonColor: extras?.buttonColor || null,
                allowExtras: !!extras?.allowExtras,
                loyaltyRewardPoints: extras?.loyaltyRewardPoints === null
                    ? null
                    : extras?.loyaltyRewardPoints !== undefined &&
                        Number.isFinite(Number(extras.loyaltyRewardPoints)) &&
                        Number(extras.loyaltyRewardPoints) >= 1
                        ? Math.floor(Number(extras.loyaltyRewardPoints))
                        : null,
                sortOrder: Number(nextSort) || 0,
                clientId: extras?.clientId,
            })
                .returning();
            return product[0];
        }
        catch (error) {
            console.error("Error creating product:", error);
            throw error;
        }
    }
    static productListWhere(merchantId, search, categoryId) {
        const whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)];
        if (categoryId) {
            whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.products.categoryId, categoryId));
        }
        if (search) {
            whereConditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(db_1.schema.products.name, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.products.sku, `%${search}%`), (0, drizzle_orm_1.like)(db_1.schema.products.barcode, `%${search}%`)));
        }
        return whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
    }
    static async countProducts(merchantId, search, categoryId) {
        const db = (0, db_1.getDb)();
        const where = this.productListWhere(merchantId, search, categoryId);
        const [row] = await db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(db_1.schema.products)
            .where(where);
        return Number(row?.total) || 0;
    }
    /**
     * Get all products for merchant
     */
    static async getProducts(merchantId, page = 1, limit = 20, search, categoryId) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            const where = this.productListWhere(merchantId, search, categoryId);
            const products = await db.query.products.findMany({
                where,
                with: {
                    category: true,
                },
                limit,
                offset,
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.sortOrder), (0, drizzle_orm_1.desc)(db_1.schema.products.createdAt)],
            });
            return products.map((p) => ({
                ...p,
                name: (0, text_encoding_1.repairCatalogText)(p.name),
                description: p.description ? (0, text_encoding_1.repairCatalogText)(p.description) : p.description,
            }));
        }
        catch (error) {
            console.error("Error getting products:", error);
            throw error;
        }
    }
    /**
     * Persist display order for products (ordered id list).
     */
    static async reorderProducts(merchantId, orderedIds) {
        const db = (0, db_1.getDb)();
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            throw new Error("orderedIds is required");
        }
        const existing = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            columns: { id: true },
        });
        const owned = new Set(existing.map((p) => p.id));
        for (const id of orderedIds) {
            if (!owned.has(id)) {
                throw new Error("Invalid product id in reorder list");
            }
        }
        await db.transaction(async (tx) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tx
                    .update(db_1.schema.products)
                    .set({ sortOrder: i, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, orderedIds[i]), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)));
            }
        });
        return this.getProducts(merchantId, 1, Math.max(orderedIds.length, 200));
    }
    /**
     * Get product by ID
     */
    static async getProductById(merchantId, productId) {
        const db = (0, db_1.getDb)();
        try {
            const product = await db.query.products.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
                with: {
                    category: true,
                },
            });
            if (!product) {
                throw new Error("Product not found");
            }
            return product;
        }
        catch (error) {
            console.error("Error getting product:", error);
            throw error;
        }
    }
    /**
     * Get product by barcode
     */
    static async getProductByBarcode(merchantId, barcode) {
        const db = (0, db_1.getDb)();
        try {
            const product = await db.query.products.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.barcode, barcode)),
            });
            return product;
        }
        catch (error) {
            console.error("Error getting product by barcode:", error);
            throw error;
        }
    }
    /**
     * Update product
     */
    static async updateProduct(merchantId, productId, updates) {
        const db = (0, db_1.getDb)();
        try {
            const patched = { ...updates };
            if (typeof patched.name === "string")
                patched.name = (0, text_encoding_1.repairCatalogText)(patched.name);
            if (typeof patched.description === "string") {
                patched.description = (0, text_encoding_1.repairCatalogText)(patched.description);
            }
            if (patched.barcode !== undefined) {
                const b = String(patched.barcode || "").trim();
                patched.barcode = b || null;
            }
            const product = await db
                .update(db_1.schema.products)
                .set({
                ...patched,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)))
                .returning();
            if (product.length === 0) {
                throw new Error("Product not found");
            }
            return product[0];
        }
        catch (error) {
            console.error("Error updating product:", error);
            throw error;
        }
    }
    /**
     * Delete product
     */
    static async deleteProduct(merchantId, productId) {
        const db = (0, db_1.getDb)();
        try {
            const result = await db
                .delete(db_1.schema.products)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)))
                .returning();
            if (result.length === 0) {
                throw new Error("Product not found");
            }
            return { success: true };
        }
        catch (error) {
            console.error("Error deleting product:", error);
            throw error;
        }
    }
    /**
     * Update stock
     */
    static async updateStock(merchantId, productId, quantity) {
        const db = (0, db_1.getDb)();
        try {
            const product = await db
                .update(db_1.schema.products)
                .set({ stock: quantity })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)))
                .returning();
            if (product.length === 0) {
                throw new Error("Product not found");
            }
            return product[0];
        }
        catch (error) {
            console.error("Error updating stock:", error);
            throw error;
        }
    }
    /**
     * Get low stock products
     */
    static async getLowStockProducts(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.lt)(db_1.schema.products.stock, db_1.schema.products.lowStockThreshold)),
                orderBy: (0, drizzle_orm_1.asc)(db_1.schema.products.stock),
            });
            return products;
        }
        catch (error) {
            console.error("Error getting low stock products:", error);
            throw error;
        }
    }
    /**
     * Get product statistics
     */
    static async getProductStatistics(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            });
            const totalProducts = products.length;
            const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
            const lowStockCount = products.filter((p) => p.stock < (p.lowStockThreshold || 5)).length;
            const totalInventoryValue = products.reduce((sum, p) => sum + parseFloat(p.cost?.toString() || "0") * p.stock, 0);
            return {
                totalProducts,
                totalStock,
                lowStockCount,
                totalInventoryValue,
            };
        }
        catch (error) {
            console.error("Error getting product statistics:", error);
            throw error;
        }
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map