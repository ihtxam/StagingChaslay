import { schema } from "@/db";
import type { CatalogChannel } from "@/lib/catalog-visibility";
export type HqMenuRow = typeof schema.hqMenus.$inferSelect;
export declare class HqMenuService {
    static list(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        channels: string[];
        locationIds: string[];
        productIds: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        hqVersionId: string | null;
    }[]>;
    static create(merchantId: string, input: {
        name: string;
        channels?: string[];
        daysOfWeek?: number[];
        timeStart?: string;
        timeEnd?: string;
        locationIds?: string[];
        hqVersionId?: string | null;
        productIds?: string[];
        isActive?: boolean;
        sortOrder?: number;
    }): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        channels: string[];
        locationIds: string[];
        productIds: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        hqVersionId: string | null;
    }>;
    static update(merchantId: string, menuId: string, input: Partial<{
        name: string;
        channels: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        locationIds: string[];
        hqVersionId: string | null;
        productIds: string[];
        isActive: boolean;
        sortOrder: number;
    }>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        channels: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        locationIds: string[];
        hqVersionId: string | null;
        productIds: string[];
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(merchantId: string, menuId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Resolve product IDs for the active HQ menu at a location/channel/time.
     * Returns null when no menu applies (show full catalog).
     */
    static resolveActiveProductIds(merchantId: string, locationId: string, channel: CatalogChannel, at?: Date): Promise<Set<string> | null>;
}
//# sourceMappingURL=hq-menu.service.d.ts.map