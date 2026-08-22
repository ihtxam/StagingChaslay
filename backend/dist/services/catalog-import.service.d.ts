export interface ImportRowError {
    sheet: string;
    row: number;
    message: string;
}
export declare class CatalogImportService {
    /**
     * One-click Excel import for categories + products.
     * Expected sheets (case-insensitive): Categories, Products
     * Categories columns: name, description?, color?, sortOrder?
     * Products columns: name, price, category (name), sku?, barcode?, stock?, cost?,
     *   taxable?, description?, productType?, isOpenPrice?, soldByWeight?, weightUnit?,
     *   bulkPricing? (JSON or "10:2.5;20:2.0"), extras? (JSON or "Extra Cheese:1.5|Bacon:2")
     */
    static importWorkbook(merchantId: string, buffer: Buffer): Promise<{
        success: boolean;
        categoriesCreated: number;
        productsCreated: number;
        productsUpdated: number;
        errors: ImportRowError[];
    }>;
    static buildTemplateBuffer(): Buffer;
    /** Export current categories + products to Excel (same columns as import template). */
    static exportWorkbook(merchantId: string): Promise<Buffer>;
}
//# sourceMappingURL=catalog-import.service.d.ts.map