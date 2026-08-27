import { schema } from "@/db";
export declare const INVENTORY_UNITS: readonly ["kg", "g", "L", "ml", "piece", "pack"];
export type InventoryUnit = string;
export declare class InventoryLicenseError extends Error {
    constructor(message?: string);
}
export declare class InventoryService {
    static getLicense(merchantId: string): Promise<{
        enabled: boolean;
        inventoryAddonEnabled: boolean;
        inventoryEnabled: boolean;
        wasteFactor: number;
        autoReorderEmailEnabled: boolean;
        expiryAlertDays: number;
        merchantName: string;
    }>;
    static assertLicensed(merchantId: string): Promise<{
        enabled: boolean;
        inventoryAddonEnabled: boolean;
        inventoryEnabled: boolean;
        wasteFactor: number;
        autoReorderEmailEnabled: boolean;
        expiryAlertDays: number;
        merchantName: string;
    }>;
    static updateSettings(merchantId: string, updates: {
        wasteFactor?: number;
        autoReorderEmailEnabled?: boolean;
        expiryAlertDays?: number;
    }): Promise<{
        enabled: boolean;
        inventoryAddonEnabled: boolean;
        inventoryEnabled: boolean;
        wasteFactor: number;
        autoReorderEmailEnabled: boolean;
        expiryAlertDays: number;
        merchantName: string;
    }>;
    static listSuppliers(merchantId: string, opts?: {
        includeArchived?: boolean;
    }): Promise<{
        linkedItemCount: number;
        id: string;
        name: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        merchantId: string;
        notes: string | null;
        contactPerson: string | null;
        archivedAt: Date | null;
        lastOrderEmailAt: Date | null;
        isDemo: boolean;
    }[]>;
    static getSupplier(merchantId: string, supplierId: string): Promise<{
        supplier: {
            id: string;
            name: string;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            merchantId: string;
            notes: string | null;
            contactPerson: string | null;
            archivedAt: Date | null;
            lastOrderEmailAt: Date | null;
            isDemo: boolean;
        };
        items: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            categoryId: string | null;
            barcode: string | null;
            cost: string;
            isDemo: boolean;
            unit: string;
            onHand: string;
            minStock: string;
            reorderQty: string;
            supplierId: string | null;
            perishable: boolean;
            autoReorderEnabled: boolean;
            lastAutoReorderAt: Date | null;
        }[];
    }>;
    static createSupplier(merchantId: string, input: {
        name: string;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        contactPerson?: string | null;
        notes?: string | null;
    }): Promise<{
        id: string;
        name: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
        address: string | null;
        merchantId: string;
        notes: string | null;
        contactPerson: string | null;
        archivedAt: Date | null;
        lastOrderEmailAt: Date | null;
        isDemo: boolean;
    }>;
    static updateSupplier(merchantId: string, supplierId: string, input: {
        name?: string;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        contactPerson?: string | null;
        notes?: string | null;
    }): Promise<{
        id: string;
        merchantId: string;
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        contactPerson: string | null;
        notes: string | null;
        archivedAt: Date | null;
        lastOrderEmailAt: Date | null;
        isDemo: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteSupplier(merchantId: string, supplierId: string): Promise<{
        supplier: {
            id: string;
            merchantId: string;
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            contactPerson: string | null;
            notes: string | null;
            archivedAt: Date | null;
            lastOrderEmailAt: Date | null;
            isDemo: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        softDeleted: boolean;
    }>;
    static listItems(merchantId: string): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }[]>;
    static serializeItem(row: typeof schema.inventoryItems.$inferSelect & {
        supplier?: typeof schema.inventorySuppliers.$inferSelect | null;
        category?: typeof schema.inventoryCategories.$inferSelect | null;
    }): {
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    };
    static createItem(merchantId: string, input: {
        name: string;
        barcode?: string | null;
        unit?: string;
        cost?: number;
        onHand?: number;
        minStock?: number;
        reorderQty?: number;
        supplierId?: string | null;
        perishable?: boolean;
        autoReorderEnabled?: boolean;
        categoryId?: string | null;
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static updateItem(merchantId: string, itemId: string, input: {
        name?: string;
        barcode?: string | null;
        unit?: string;
        cost?: number;
        minStock?: number;
        reorderQty?: number;
        supplierId?: string | null;
        perishable?: boolean;
        autoReorderEnabled?: boolean;
        categoryId?: string | null;
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static deleteItem(merchantId: string, itemId: string): Promise<{
        ok: boolean;
    }>;
    static stockIn(merchantId: string, itemId: string, input: {
        qty: number;
        unit?: string;
        unitCost?: number;
        note?: string;
        supplierName?: string;
        date?: string;
        expiryDate?: string | null;
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static stockOut(merchantId: string, itemId: string, input: {
        qty: number;
        note?: string;
        reason?: "waste" | "out";
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static waste(merchantId: string, itemId: string, input: {
        qty: number;
        note?: string;
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static countStock(merchantId: string, itemId: string, input: {
        realQty: number;
        note?: string;
    }): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }>;
    static listMovements(merchantId: string, itemId?: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        note: string | null;
        merchantId: string;
        type: string;
        orderId: string | null;
        itemId: string;
        qty: string;
        unitCost: string | null;
        supplierName: string | null;
        item: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            categoryId: string | null;
            barcode: string | null;
            cost: string;
            isDemo: boolean;
            unit: string;
            onHand: string;
            minStock: string;
            reorderQty: string;
            supplierId: string | null;
            perishable: boolean;
            autoReorderEnabled: boolean;
            lastAutoReorderAt: Date | null;
        };
    }[]>;
    static lowStock(merchantId: string): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }[]>;
    static getItemByBarcode(merchantId: string, barcode: string): Promise<{
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    } | null>;
    static listExpiringSoon(merchantId: string): Promise<{
        leadDays: number;
        lots: Array<Record<string, unknown>>;
    } | {
        leadDays: number;
        lots: {
            id: string;
            itemId: string;
            itemName: string;
            unit: string;
            qty: number;
            expiryDate: Date | null;
            daysLeft: number | null;
            expired: boolean;
        }[];
    }>;
    static getStorekeeperBootstrap(merchantId: string): Promise<{
        categories: {
            id: string;
            name: string;
        }[];
        units: {
            code: string;
            name: string;
        }[];
        enabled: boolean;
        inventoryAddonEnabled: boolean;
        inventoryEnabled: boolean;
        wasteFactor: number;
        autoReorderEmailEnabled: boolean;
        expiryAlertDays: number;
        merchantName: string;
    }>;
    static storekeeperIntake(merchantId: string, input: {
        barcode: string;
        name?: string;
        unit?: string;
        categoryId?: string | null;
        qty: number;
        expiryDate?: string | null;
        cost?: number;
        note?: string;
    }): Promise<{
        item: {
            onHand: number;
            minStock: number;
            reorderQty: number;
            cost: number;
            lowStock: boolean;
            outOfStock: boolean;
            categoryId: string | null;
            category: {
                id: string;
                name: string;
            } | null;
            supplier: {
                id: string;
                name: string;
                email: string | null;
                archivedAt: Date | null;
            } | null;
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            barcode: string | null;
            isDemo: boolean;
            unit: string;
            supplierId: string | null;
            perishable: boolean;
            autoReorderEnabled: boolean;
            lastAutoReorderAt: Date | null;
        };
        created: boolean;
    }>;
    private static assertBarcodeAvailable;
    private static createStockLot;
    static usageReport(merchantId: string, days?: number): Promise<{
        theoreticalUsage: number;
        wasteQty: number;
        stockInQty: number;
        onHand: number;
        minStock: number;
        reorderQty: number;
        cost: number;
        lowStock: boolean;
        outOfStock: boolean;
        categoryId: string | null;
        category: {
            id: string;
            name: string;
        } | null;
        supplier: {
            id: string;
            name: string;
            email: string | null;
            archivedAt: Date | null;
        } | null;
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        barcode: string | null;
        isDemo: boolean;
        unit: string;
        supplierId: string | null;
        perishable: boolean;
        autoReorderEnabled: boolean;
        lastAutoReorderAt: Date | null;
    }[]>;
    static getRecipe(merchantId: string, productId: string): Promise<{
        product: {
            recipeYield: number;
            id: string;
            name: string;
            sku: string | null;
            productType: string;
        };
        recipeYield: number;
        lines: {
            id: string;
            itemId: string;
            qty: number;
            unit: string;
            itemName: string;
            itemUnit: string;
        }[];
    }>;
    static listCookbook(merchantId: string): Promise<{
        productId: string;
        name: string;
        sku: string | null;
        isActive: boolean;
        productType: string;
        recipeYield: number;
        lines: {
            id: string;
            itemId: string;
            qty: number;
            unit: string;
            itemName: string;
            itemUnit: string;
        }[];
    }[]>;
    static setRecipe(merchantId: string, productId: string, lines: Array<{
        itemId: string;
        qty: number;
        unit?: string;
    }>, recipeYield?: number): Promise<{
        product: {
            recipeYield: number;
            id: string;
            name: string;
            sku: string | null;
            productType: string;
        };
        recipeYield: number;
        lines: {
            id: string;
            itemId: string;
            qty: number;
            unit: string;
            itemName: string;
            itemUnit: string;
        }[];
    }>;
    static deductForPaidOrder(merchantId: string, orderId: string): Promise<{
        deducted: boolean;
        reason: string;
        items?: undefined;
    } | {
        deducted: boolean;
        items: number;
        reason?: undefined;
    }>;
    static sendReorderEmail(merchantId: string, opts: {
        itemIds?: string[];
        supplierId?: string;
        force?: boolean;
    }): Promise<{
        sent: {
            supplierId: string;
            email: string;
            items: number;
        }[];
    }>;
    static listCategories(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        merchantId: string;
        isDemo: boolean;
    }[]>;
    static createCategory(merchantId: string, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        merchantId: string;
        isDemo: boolean;
    }>;
    static deleteCategory(merchantId: string, categoryId: string): Promise<{
        ok: boolean;
    }>;
    static listUnits(merchantId: string): Promise<{
        units: {
            id: string;
            name: string;
            createdAt: Date;
            merchantId: string;
            code: string;
            isDemo: boolean;
        }[];
        ratios: {
            factor: number;
            id: string;
            createdAt: Date;
            merchantId: string;
            isDemo: boolean;
            fromCode: string;
            toCode: string;
        }[];
    }>;
    static createUnit(merchantId: string, input: {
        code: string;
        name: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        merchantId: string;
        code: string;
        isDemo: boolean;
    }>;
    static deleteUnit(merchantId: string, unitId: string): Promise<{
        ok: boolean;
    }>;
    static createRatio(merchantId: string, input: {
        fromCode: string;
        toCode: string;
        factor: number;
    }): Promise<{
        factor: number;
        id: string;
        createdAt: Date;
        merchantId: string;
        isDemo: boolean;
        fromCode: string;
        toCode: string;
    }>;
    static deleteRatio(merchantId: string, ratioId: string): Promise<{
        ok: boolean;
    }>;
    static purchaseReport(merchantId: string, days?: number): Promise<{
        byStock: {
            name: string;
            qty: number;
            cost: number;
        }[];
        bySupplier: {
            name: string;
            qty: number;
            cost: number;
        }[];
        byDate: {
            qty: number;
            cost: number;
            date: string;
        }[];
    }>;
    private static getOwnedItem;
    private static assertCategory;
    private static toBaseQty;
    private static assertSupplier;
    private static applyMovement;
    private static maybeAutoReorder;
}
//# sourceMappingURL=inventory.service.d.ts.map