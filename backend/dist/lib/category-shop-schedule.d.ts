import { type MenuScheduleType, type MenuTimeRange } from "@/lib/scheduled-menu";
export type CategoryShopSchedule = {
    enabled?: boolean;
    scheduleType?: MenuScheduleType | string;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    timeStart?: string | null;
    timeEnd?: string | null;
    timeRanges?: MenuTimeRange[] | null;
};
export declare const DEFAULT_CATEGORY_SHOP_SCHEDULE: CategoryShopSchedule;
export declare function normalizeCategoryShopSchedule(raw: unknown): CategoryShopSchedule;
/** When schedule disabled, category is always visible (subject to channel + products). */
export declare function isCategoryShopScheduleVisible(schedule: unknown, at: Date, timezone?: string): boolean;
//# sourceMappingURL=category-shop-schedule.d.ts.map