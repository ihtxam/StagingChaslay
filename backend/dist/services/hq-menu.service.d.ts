import { schema } from "@/db";
import type { CatalogChannel } from "@/lib/catalog-visibility";
export type HqMenuRow = typeof schema.hqMenus.$inferSelect;
export type ResolvedHqMenu = {
    menu: HqMenuRow | null;
    productIds: Set<string> | null;
    productPrices: Record<string, number>;
};
export declare class HqMenuService {
    static list(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        isDefault: boolean;
        channels: string[];
        locationIds: string[];
        categoryIds: string[];
        productIds: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        scheduleType: string;
        daysOfMonth: number[];
        timeRanges: {
            start: string;
            end: string;
        }[];
        productPrices: Record<string, number>;
        hqVersionId: string | null;
    }[]>;
    static ensureDefaultMenu(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        isDefault: boolean;
        channels: string[];
        locationIds: string[];
        categoryIds: string[];
        productIds: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        scheduleType: string;
        daysOfMonth: number[];
        timeRanges: {
            start: string;
            end: string;
        }[];
        productPrices: Record<string, number>;
        hqVersionId: string | null;
    }>;
    static create(merchantId: string, input: Record<string, unknown>): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        isDefault: boolean;
        channels: string[];
        locationIds: string[];
        categoryIds: string[];
        productIds: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        scheduleType: string;
        daysOfMonth: number[];
        timeRanges: {
            start: string;
            end: string;
        }[];
        productPrices: Record<string, number>;
        hqVersionId: string | null;
    }>;
    static update(merchantId: string, menuId: string, input: Record<string, unknown>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        channels: string[];
        daysOfWeek: number[];
        timeStart: string;
        timeEnd: string;
        scheduleType: string;
        daysOfMonth: number[];
        timeRanges: {
            start: string;
            end: string;
        }[];
        productPrices: Record<string, number>;
        isDefault: boolean;
        locationIds: string[];
        hqVersionId: string | null;
        productIds: string[];
        categoryIds: string[];
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(merchantId: string, menuId: string): Promise<{
        success: boolean;
    }>;
    static resolveActiveMenu(merchantId: string, locationId: string, channel: CatalogChannel, at?: Date, timezone?: string): Promise<ResolvedHqMenu>;
    static resolveActiveProductIds(merchantId: string, locationId: string, channel: CatalogChannel, at?: Date, timezone?: string): Promise<Set<string> | null>;
    static applyMenuPrices<T extends {
        id: string;
        price: number | string;
        isOpenPrice?: boolean | null;
    } & Record<string, unknown>>(products: T[], menuPrices: Record<string, number> | null | undefined): T[];
}
//# sourceMappingURL=hq-menu.service.d.ts.map