"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const db_1 = require("@/db");
const category_colors_1 = require("@/lib/category-colors");
const text_encoding_1 = require("@/lib/text-encoding");
const drizzle_orm_1 = require("drizzle-orm");
class CategoryService {
    /**
     * Create category
     */
    static async createCategory(merchantId, name, description, color) {
        const db = (0, db_1.getDb)();
        try {
            const trimmedName = String(name || "").trim();
            if (!String(name || "").length)
                throw new Error("Category name is required");
            if (!trimmedName)
                throw new Error("Category name cannot be only spaces");
            if (trimmedName.length > 56)
                throw new Error("Category name must be 56 characters or fewer");
            const trimmedDescription = description == null ? description : String(description).trim();
            if (typeof trimmedDescription === "string" && trimmedDescription.length > 256) {
                throw new Error("Description must be 256 characters or fewer");
            }
            const [{ nextSort }] = await db
                .select({
                nextSort: (0, drizzle_orm_1.sql) `coalesce(${(0, drizzle_orm_1.max)(db_1.schema.categories.sortOrder)}, -1) + 1`,
            })
                .from(db_1.schema.categories)
                .where((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId));
            const [{ catCount }] = await db
                .select({ catCount: (0, drizzle_orm_1.count)() })
                .from(db_1.schema.categories)
                .where((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId));
            const resolvedColor = (0, category_colors_1.isValidHexColor)(color)
                ? (0, category_colors_1.normalizeHexColor)(color)
                : (0, category_colors_1.paletteColorAt)(Number(catCount) || 0);
            const category = await db
                .insert(db_1.schema.categories)
                .values({
                merchantId,
                name: (0, text_encoding_1.repairCatalogText)(trimmedName),
                description: trimmedDescription
                    ? (0, text_encoding_1.repairCatalogText)(trimmedDescription)
                    : trimmedDescription,
                color: resolvedColor,
                sortOrder: Number(nextSort) || 0,
            })
                .returning();
            return category[0];
        }
        catch (error) {
            console.error("Error creating category:", error);
            throw error;
        }
    }
    /**
     * Get all categories for merchant
     */
    static async getCategories(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const categories = await db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.desc)(db_1.schema.categories.createdAt)],
            });
            return categories;
        }
        catch (error) {
            console.error("Error getting categories:", error);
            throw error;
        }
    }
    /**
     * Persist display order for categories (ordered id list).
     */
    static async reorderCategories(merchantId, orderedIds) {
        const db = (0, db_1.getDb)();
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            throw new Error("orderedIds is required");
        }
        const existing = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
            columns: { id: true },
        });
        const owned = new Set(existing.map((c) => c.id));
        for (const id of orderedIds) {
            if (!owned.has(id)) {
                throw new Error("Invalid category id in reorder list");
            }
        }
        await db.transaction(async (tx) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tx
                    .update(db_1.schema.categories)
                    .set({ sortOrder: i, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.id, orderedIds[i]), (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId)));
            }
        });
        return this.getCategories(merchantId);
    }
    /**
     * Get category by ID
     */
    static async getCategoryById(merchantId, categoryId) {
        const db = (0, db_1.getDb)();
        try {
            const category = await db.query.categories.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId)),
            });
            if (!category) {
                throw new Error("Category not found");
            }
            return category;
        }
        catch (error) {
            console.error("Error getting category:", error);
            throw error;
        }
    }
    /**
     * Update category
     */
    static async updateCategory(merchantId, categoryId, updates) {
        const db = (0, db_1.getDb)();
        try {
            const patched = { ...updates };
            if (typeof patched.name === "string")
                patched.name = (0, text_encoding_1.repairCatalogText)(patched.name);
            if (typeof patched.description === "string") {
                patched.description = (0, text_encoding_1.repairCatalogText)(patched.description);
            }
            const category = await db
                .update(db_1.schema.categories)
                .set(patched)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId)))
                .returning();
            if (category.length === 0) {
                throw new Error("Category not found");
            }
            return category[0];
        }
        catch (error) {
            console.error("Error updating category:", error);
            throw error;
        }
    }
    /**
     * Delete category
     */
    static async deleteCategory(merchantId, categoryId) {
        const db = (0, db_1.getDb)();
        try {
            // Check if category has products
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.products.categoryId, categoryId),
            });
            if (products.length > 0) {
                throw new Error("Cannot delete category with products");
            }
            const result = await db
                .delete(db_1.schema.categories)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId)))
                .returning();
            if (result.length === 0) {
                throw new Error("Category not found");
            }
            return { success: true };
        }
        catch (error) {
            console.error("Error deleting category:", error);
            throw error;
        }
    }
    /**
     * Get category with products
     */
    static async getCategoryWithProducts(merchantId, categoryId) {
        const db = (0, db_1.getDb)();
        try {
            const category = await db.query.categories.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.id, categoryId), (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId)),
            });
            if (!category) {
                throw new Error("Category not found");
            }
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.products.categoryId, categoryId),
            });
            return {
                category,
                products,
                productCount: products.length,
            };
        }
        catch (error) {
            console.error("Error getting category with products:", error);
            throw error;
        }
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map