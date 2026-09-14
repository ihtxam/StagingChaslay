import { type MerchantProductSurface } from "@/lib/merchant-product-surface";
export declare class MerchantProductSurfaceService {
    static apply(merchantId: string, surface: MerchantProductSurface): Promise<{
        surface: MerchantProductSurface;
        merchantId: string;
        editionId: string;
        editionName: string;
        shopEnabled: boolean;
        cmsHomepageEnabled: boolean;
        maxPosPosts: number;
        hasPos: boolean;
        showOrderCenter: boolean;
    }>;
    static setPosEnabled(merchantId: string, enabled: boolean): Promise<{
        posEnabled: boolean;
        maxPosPosts: number;
    }>;
}
//# sourceMappingURL=merchant-product-surface.service.d.ts.map