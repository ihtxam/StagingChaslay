import { schema } from "@/db";
import { type CatalogChannel } from "@/lib/catalog-visibility";
type ProductRow = typeof schema.products.$inferSelect;
export declare class CatalogLocationService {
    /** Merge per-location price, visibility, and availability overrides onto products. */
    static applyLocationOverrides<T extends ProductRow>(merchantId: string, locationId: string | null | undefined, products: T[]): Promise<T[]>;
    /** Filter products to an active HQ time-based menu when one matches. */
    static filterByHqMenuProductIds<T extends {
        id: string;
    }>(products: T[], allowedIds: Set<string> | null): T[];
    static productVisibleAfterOverrides(product: {
        visibility?: unknown;
        isActive?: boolean | null;
    }, channel: CatalogChannel): boolean;
}
export {};
//# sourceMappingURL=catalog-location.service.d.ts.map