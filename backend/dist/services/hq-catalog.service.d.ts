export type BulkPricingPreviewRow = {
    productId: string;
    name: string;
    categoryId: string | null;
    currentPrice: number;
    newPrice: number;
};
export type BulkPricingPreview = {
    token: string;
    rows: BulkPricingPreviewRow[];
    affectedCount: number;
};
export declare class BulkPricingService {
    static preview(merchantId: string, input: {
        locationIds?: string[];
        categoryIds?: string[];
        productIds?: string[];
        operation: "increase" | "decrease";
        valueType: "fixed" | "percent";
        value: number;
        roundTo?: number | null;
    }): Promise<BulkPricingPreview>;
    static apply(merchantId: string, previewToken: string, opts?: {
        staffId?: string | null;
        staffName?: string | null;
        locationIds?: string[];
    }): Promise<{
        affectedCount: number;
    }>;
    static listJobs(merchantId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        merchantId: string;
        createdByStaffId: string | null;
        locationIds: string[];
        categoryIds: string[];
        productIds: string[];
        operation: string;
        valueType: string;
        value: string;
        roundTo: string | null;
        affectedCount: number;
        createdByName: string | null;
    }[]>;
}
export declare class HqCatalogService {
    static listVersions(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        merchantId: string;
        version: number;
        payloadJson: Record<string, unknown>;
        createdByStaffId: string | null;
    }[]>;
    static createVersion(merchantId: string, input: {
        name?: string;
        productIds?: string[];
        staffId?: string | null;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        merchantId: string;
        version: number;
        payloadJson: Record<string, unknown>;
        createdByStaffId: string | null;
    }>;
    static pushToLocations(merchantId: string, input: {
        versionId: string;
        locationIds: string[];
        overwritePrices?: boolean;
    }): Promise<{
        linked: number;
        locationCount: number;
    }>;
    static listLocationLinks(merchantId: string, locationId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        locationId: string;
        hqProductId: string;
        localProductId: string | null;
        syncStatus: string;
        overridesJson: Record<string, unknown>;
        fromHqVersionId: string | null;
    }[]>;
}
//# sourceMappingURL=hq-catalog.service.d.ts.map