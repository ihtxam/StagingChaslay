import { schema } from "@/db";
import { type CatalogChannel } from "@/lib/catalog-visibility";
export declare class CategoryService {
    /**
     * Create category
     */
    static createCategory(merchantId: string, name: string, description?: string, color?: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        color: string | null;
        isOffersCategory: boolean;
        visibility: {
            channels: string[];
        };
        shopSchedule: Record<string, unknown>;
        deliveryPricingEnabled: boolean;
        extraDeliveryPrice: string | null;
        clientId: string | null;
    }>;
    /**
     * Get all categories for merchant
     */
    static getCategories(merchantId: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        color: string | null;
        isOffersCategory: boolean;
        visibility: {
            channels: string[];
        };
        shopSchedule: Record<string, unknown>;
        deliveryPricingEnabled: boolean;
        extraDeliveryPrice: string | null;
        clientId: string | null;
    }[]>;
    /**
     * Persist display order for categories (ordered id list).
     */
    static reorderCategories(merchantId: string, orderedIds: string[]): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        color: string | null;
        isOffersCategory: boolean;
        visibility: {
            channels: string[];
        };
        shopSchedule: Record<string, unknown>;
        deliveryPricingEnabled: boolean;
        extraDeliveryPrice: string | null;
        clientId: string | null;
    }[]>;
    /**
     * Get category by ID
     */
    static getCategoryById(merchantId: string, categoryId: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        color: string | null;
        isOffersCategory: boolean;
        visibility: {
            channels: string[];
        };
        shopSchedule: Record<string, unknown>;
        deliveryPricingEnabled: boolean;
        extraDeliveryPrice: string | null;
        clientId: string | null;
    }>;
    /**
     * Update category
     */
    static updateCategory(merchantId: string, categoryId: string, updates: Partial<typeof schema.categories.$inferInsert>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        description: string | null;
        color: string | null;
        imageUrl: string | null;
        isOffersCategory: boolean;
        visibility: {
            channels: string[];
        };
        shopSchedule: Record<string, unknown>;
        deliveryPricingEnabled: boolean;
        extraDeliveryPrice: string | null;
        sortOrder: number;
        clientId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Merge channels into category visibility when a product is enabled on those channels. */
    static ensureChannelsEnabled(merchantId: string, categoryId: string, channels: CatalogChannel[]): Promise<void>;
    /**
     * Delete category
     */
    static deleteCategory(merchantId: string, categoryId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Get category with products
     */
    static getCategoryWithProducts(merchantId: string, categoryId: string): Promise<{
        category: {
            id: string;
            name: string;
            imageUrl: string | null;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            sortOrder: number;
            description: string | null;
            color: string | null;
            isOffersCategory: boolean;
            visibility: {
                channels: string[];
            };
            shopSchedule: Record<string, unknown>;
            deliveryPricingEnabled: boolean;
            extraDeliveryPrice: string | null;
            clientId: string | null;
        };
        products: {
            id: string;
            name: string;
            imageUrl: string | null;
            brand: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            sortOrder: number;
            description: string | null;
            visibility: {
                channels: string[];
            };
            clientId: string | null;
            categoryId: string | null;
            sku: string | null;
            barcode: string | null;
            price: string;
            cost: string | null;
            stock: number;
            lowStockThreshold: number | null;
            isTaxable: boolean;
            productType: string;
            isOpenPrice: boolean;
            soldByWeight: boolean;
            weightUnit: string | null;
            bulkPricing: {
                minQty: number;
                price: number;
            }[] | null;
            extras: {
                id: string;
                name: string;
                price: number;
            }[] | null;
            comboItems: {
                id?: string;
                name?: string;
                minPick?: number;
                maxPick?: number;
                options?: Array<{
                    productId: string;
                    extraPrice?: number;
                }>;
                productId?: string;
                quantity?: number;
            }[] | null;
            cateringConfig: Record<string, unknown> | null;
            specifications: {
                id: string;
                name: string;
                price: number;
                saleStatus?: "in_stock" | "out_of_stock";
                isDefault?: boolean;
                sortOrder?: number;
            }[] | null;
            buttonColor: string | null;
            allowExtras: boolean;
            loyaltyRewardPoints: number | null;
            recipeYield: string;
            similarProductIds: string[] | null;
            dietaryTags: string[] | null;
            extraBarcodes: string[] | null;
            timeSlotPrices: Record<string, {
                price?: number;
                multiplier?: number;
            }> | null;
        }[];
        productCount: number;
    }>;
}
//# sourceMappingURL=category.service.d.ts.map