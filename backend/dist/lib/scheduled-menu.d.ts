import { type CatalogChannel } from "@/lib/catalog-visibility";
export type MenuScheduleType = "daily" | "weekly" | "monthly";
export type MenuTimeRange = {
    start: string;
    end: string;
};
export type UniformPricingInput = {
    mode: "fixed" | "percent";
    /** Fixed CHF amount, or percent points (e.g. 10 = 10%). Negative fixed = decrease. */
    value: number;
    direction?: "increase" | "decrease";
};
export type ScheduledMenuLike = {
    scheduleType?: MenuScheduleType | string | null;
    daysOfWeek?: number[] | null;
    daysOfMonth?: number[] | null;
    timeStart?: string | null;
    timeEnd?: string | null;
    timeRanges?: MenuTimeRange[] | null;
    isDefault?: boolean | null;
    sortOrder?: number | null;
    isActive?: boolean | null;
    channels?: string[] | null;
    locationIds?: string[] | null;
    productPrices?: Record<string, number> | null;
};
export declare function parseHm(time: string): number;
export declare function isHmInWindow(curMinutes: number, start: string, end: string): boolean;
export declare function normalizeTimeRanges(ranges: unknown, fallbackStart?: string | null, fallbackEnd?: string | null): MenuTimeRange[];
export declare function normalizeProductPrices(raw: unknown): Record<string, number>;
export declare function isMenuScheduleActive(menu: ScheduledMenuLike, at: Date, timezone?: string): boolean;
export declare function pickActiveScheduledMenu<T extends ScheduledMenuLike>(menus: T[], opts: {
    channel: CatalogChannel | string;
    locationId: string;
    at?: Date;
    timezone?: string;
}): T | null;
export declare function applyUniformPricing(basePrice: number, input: UniformPricingInput): number;
export declare function applyUniformPricingToMap(basePrices: Record<string, number>, input: UniformPricingInput): Record<string, number>;
export type ProductWithPrice = {
    id: string;
    price: number | string;
    isOpenPrice?: boolean | null;
};
export declare function applyMenuProductPrices<T extends ProductWithPrice & Record<string, unknown>>(products: T[], menuPrices: Record<string, number> | null | undefined): T[];
//# sourceMappingURL=scheduled-menu.d.ts.map