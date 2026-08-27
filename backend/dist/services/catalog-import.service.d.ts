export interface ImportRowError {
    sheet: string;
    row: number;
    message: string;
}
export declare class CatalogImportService {
    /**
     * One-click Excel import for categories + modifier groups + products.
     * Expected sheets (case-insensitive):
     * - Categories: name, description?, color?, sortOrder?
     * - ModifierGroups: title, pricingType?, selectionType?, minSelectable?, maxSelectable?, options?
     * - Products: name, price, category (name), sku?, barcode?, stock?, cost?,
     *   taxable?, description?, productType?, isOpenPrice?, soldByWeight?, weightUnit?,
     *   bulkPricing? (10:2.5;20:2.0), specifications? (Small:8.9|Large:10.5*),
     *   modifierGroups? (Milk|Toppings), extras? (Extra Cheese:1.5|Bacon:2), allowExtras?
     */
    static importWorkbook(merchantId: string, buffer: Buffer): Promise<{
        success: boolean;
        categoriesCreated: number;
        productsCreated: number;
        productsUpdated: number;
        modifierGroupsCreated: number;
        modifierGroupsUpdated: number;
        errors: ImportRowError[];
    }>;
    private static importModifierGroupsSheet;
    static buildTemplateBuffer(): Buffer;
    /** Export current categories + modifier groups + products to Excel (same columns as import template). */
    static exportWorkbook(merchantId: string): Promise<Buffer>;
}
//# sourceMappingURL=catalog-import.service.d.ts.map