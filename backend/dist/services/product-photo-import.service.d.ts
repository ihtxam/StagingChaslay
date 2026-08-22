export declare class ProductPhotoImportService {
    static importMissing(merchantId: string, opts?: {
        productIds?: string[];
        limit?: number;
    }): Promise<{
        updated: number;
        skipped: number;
        failed: number;
        products: Array<{
            id: string;
            imageUrl: string;
        }>;
    }>;
}
//# sourceMappingURL=product-photo-import.service.d.ts.map