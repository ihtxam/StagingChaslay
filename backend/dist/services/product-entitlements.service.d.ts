export type ProductLimitInfo = {
    /** null = unlimited */
    maxProducts: number | null;
    currentCount: number;
    planSlug: string | null;
    planName: string | null;
};
export declare class ProductEntitlementsService {
    static countProducts(merchantId: string): Promise<number>;
    static getLimitInfo(merchantId: string): Promise<ProductLimitInfo>;
    static assertCanAddProducts(merchantId: string, addCount?: number): Promise<ProductLimitInfo>;
}
//# sourceMappingURL=product-entitlements.service.d.ts.map