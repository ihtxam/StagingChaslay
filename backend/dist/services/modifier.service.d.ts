export type PricingType = "free" | "fixed" | "toppings_by_size";
export type SelectionType = "optional" | "required";
export type SaleStatus = "in_stock" | "out_of_stock";
export type ModifierOptionInput = {
    id?: string;
    name: string;
    price?: number;
    saleStatus?: SaleStatus;
    isDefault?: boolean;
    sortOrder?: number;
    inventoryItemId?: string | null;
    inventoryQty?: number;
};
export type ModifierGroupInput = {
    title: string;
    pricingType?: PricingType;
    selectionType?: SelectionType;
    minSelectable?: number;
    maxSelectable?: number;
    defaultCollapsed?: boolean;
    allowMultipleSameItem?: boolean;
    sortOrder?: number;
    options?: ModifierOptionInput[];
    productIds?: string[];
};
export declare class ModifierService {
    static list(merchantId: string): Promise<{
        id: any;
        title: any;
        pricingType: PricingType;
        selectionType: SelectionType;
        minSelectable: any;
        maxSelectable: any;
        defaultCollapsed: boolean;
        allowMultipleSameItem: boolean;
        sortOrder: any;
        isActive: boolean;
        options: any;
        products: any;
        productIds: any;
        createdAt: any;
        updatedAt: any;
    }[]>;
    static getById(merchantId: string, groupId: string): Promise<{
        id: any;
        title: any;
        pricingType: PricingType;
        selectionType: SelectionType;
        minSelectable: any;
        maxSelectable: any;
        defaultCollapsed: boolean;
        allowMultipleSameItem: boolean;
        sortOrder: any;
        isActive: boolean;
        options: any;
        products: any;
        productIds: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static create(merchantId: string, input: ModifierGroupInput): Promise<{
        id: any;
        title: any;
        pricingType: PricingType;
        selectionType: SelectionType;
        minSelectable: any;
        maxSelectable: any;
        defaultCollapsed: boolean;
        allowMultipleSameItem: boolean;
        sortOrder: any;
        isActive: boolean;
        options: any;
        products: any;
        productIds: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static update(merchantId: string, groupId: string, input: ModifierGroupInput): Promise<{
        id: any;
        title: any;
        pricingType: PricingType;
        selectionType: SelectionType;
        minSelectable: any;
        maxSelectable: any;
        defaultCollapsed: boolean;
        allowMultipleSameItem: boolean;
        sortOrder: any;
        isActive: boolean;
        options: any;
        products: any;
        productIds: any;
        createdAt: any;
        updatedAt: any;
    }>;
    static remove(merchantId: string, groupId: string): Promise<{
        success: boolean;
    }>;
    static setProductLinks(merchantId: string, groupId: string, productIds: string[]): Promise<void>;
    /** Link/unlink groups from a product (product editor side). */
    static setGroupsForProduct(merchantId: string, productId: string, groupIds: string[]): Promise<any[]>;
    static getGroupsForProduct(merchantId: string, productId: string): Promise<any[]>;
    /** Batch-load modifier groups for many products (WebPOS / catalog). */
    static getGroupsForProducts(merchantId: string, productIds: string[]): Promise<Map<string, any[]>>;
    private static replaceOptions;
    private static syncLinkedProductsExtras;
    /** Flatten linked in-stock options into product.extras for POS/shop compatibility. */
    static refreshProductExtras(merchantId: string, productId: string): Promise<void>;
    private static serializeGroup;
}
//# sourceMappingURL=modifier.service.d.ts.map