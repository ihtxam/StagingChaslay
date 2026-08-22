import type { EditionFeatureKey } from "@/lib/edition-features";
export declare class EditionEntitlementsService {
    static invalidate(merchantId: string): void;
    static getFeatures(merchantId: string): Promise<EditionFeatureKey[] | null>;
    static require(merchantId: string, feature: EditionFeatureKey): Promise<EditionFeatureKey[] | null>;
}
//# sourceMappingURL=edition-entitlements.service.d.ts.map