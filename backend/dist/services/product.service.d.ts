import { schema } from "@/db";
export declare class ProductService {
    /**
     * Create product
     */
    static createProduct(merchantId: string, name: string, price: number, categoryId?: string, sku?: string, barcode?: string, cost?: number, stock?: number, isTaxable?: boolean, description?: string, imageUrl?: string, extras?: {
        productType?: string;
        isOpenPrice?: boolean;
        soldByWeight?: boolean;
        weightUnit?: string;
        bulkPricing?: Array<{
            minQty: number;
            price: number;
        }>;
        extras?: Array<{
            id: string;
            name: string;
            price: number;
        }>;
        comboItems?: Array<{
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
        }>;
        allowExtras?: boolean;
        clientId?: string;
        specifications?: Array<{
            id: string;
            name: string;
            price: number;
            saleStatus?: "in_stock" | "out_of_stock";
            isDefault?: boolean;
            sortOrder?: number;
        }>;
        buttonColor?: string;
        /** Null clears; integer ≥ 1 sets free-with-points cost */
        loyaltyRewardPoints?: number | null;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
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
    }>;
    private static productListWhere;
    static countProducts(merchantId: string, search?: string, categoryId?: string): Promise<number>;
    /**
     * Get all products for merchant
     */
    static getProducts(merchantId: string, page?: number, limit?: number, search?: string, categoryId?: string): Promise<{
        name: string;
        description: string | null;
        id: string;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
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
            deliveryPricingEnabled: boolean;
            extraDeliveryPrice: string | null;
            clientId: string | null;
        } | null;
    }[]>;
    /**
     * Persist display order for products (ordered id list).
     */
    static reorderProducts(merchantId: string, orderedIds: string[]): Promise<{
        name: string;
        description: string | null;
        id: string;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
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
            deliveryPricingEnabled: boolean;
            extraDeliveryPrice: string | null;
            clientId: string | null;
        } | null;
    }[]>;
    /**
     * Get product by ID
     */
    static getProductById(merchantId: string, productId: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
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
            deliveryPricingEnabled: boolean;
            extraDeliveryPrice: string | null;
            clientId: string | null;
        } | null;
    }>;
    /**
     * Get product by barcode
     */
    static getProductByBarcode(merchantId: string, barcode: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
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
    } | undefined>;
    /**
     * Update product
     */
    static updateProduct(merchantId: string, productId: string, updates: Partial<typeof schema.products.$inferInsert>): Promise<{
        id: string;
        merchantId: string;
        categoryId: string | null;
        name: string;
        sku: string | null;
        barcode: string | null;
        price: string;
        cost: string | null;
        stock: number;
        lowStockThreshold: number | null;
        isTaxable: boolean;
        description: string | null;
        imageUrl: string | null;
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
        sortOrder: number;
        clientId: string | null;
        isActive: boolean;
        visibility: {
            channels: string[];
        };
        similarProductIds: string[] | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Delete product
     */
    static deleteProduct(merchantId: string, productId: string): Promise<{
        success: boolean;
        deactivated?: undefined;
    } | {
        success: boolean;
        deactivated: boolean;
    }>;
    /**
     * Update stock
     */
    static updateStock(merchantId: string, productId: string, quantity: number): Promise<{
        id: string;
        merchantId: string;
        categoryId: string | null;
        name: string;
        sku: string | null;
        barcode: string | null;
        price: string;
        cost: string | null;
        stock: number;
        lowStockThreshold: number | null;
        isTaxable: boolean;
        description: string | null;
        imageUrl: string | null;
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
        sortOrder: number;
        clientId: string | null;
        isActive: boolean;
        visibility: {
            channels: string[];
        };
        similarProductIds: string[] | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Get low stock products
     */
    static getLowStockProducts(merchantId: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
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
    }[]>;
    /**
     * Get product statistics
     */
    static getProductStatistics(merchantId: string): Promise<{
        totalProducts: number;
        totalStock: number;
        lowStockCount: number;
        totalInventoryValue: number;
    }>;
}
//# sourceMappingURL=product.service.d.ts.map