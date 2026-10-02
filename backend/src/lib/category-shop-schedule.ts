import {
  isMenuScheduleActive,
  normalizeTimeRanges,
  type MenuScheduleType,
  type MenuTimeRange,
} from "@/lib/scheduled-menu";

export type CategoryShopSchedule = {
  enabled?: boolean;
  scheduleType?: MenuScheduleType | string;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  timeStart?: string | null;
  timeEnd?: string | null;
  timeRanges?: MenuTimeRange[] | null;
};

export const DEFAULT_CATEGORY_SHOP_SCHEDULE: CategoryShopSchedule = {
  enabled: false,
  scheduleType: "weekly",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  daysOfMonth: [],
  timeRanges: [{ start: "00:00", end: "23:59" }],
};

export function normalizeCategoryShopSchedule(raw: unknown): CategoryShopSchedule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CATEGORY_SHOP_SCHEDULE };
  }
  const o = raw as Record<string, unknown>;
  const scheduleType = (o.scheduleType || o.schedule_type || "weekly") as MenuScheduleType;
  const daysOfWeek = Array.isArray(o.daysOfWeek ?? o.days_of_week)
    ? (o.daysOfWeek ?? o.days_of_week) as number[]
    : DEFAULT_CATEGORY_SHOP_SCHEDULE.daysOfWeek!;
  const daysOfMonth = Array.isArray(o.daysOfMonth ?? o.days_of_month)
    ? (o.daysOfMonth ?? o.days_of_month) as number[]
    : [];
  const timeRanges = normalizeTimeRanges(
    o.timeRanges ?? o.time_ranges,
    typeof o.timeStart === "string" ? o.timeStart : null,
    typeof o.timeEnd === "string" ? o.timeEnd : null
  );
  return {
    enabled: o.enabled === true,
    scheduleType,
    daysOfWeek,
    daysOfMonth,
    timeRanges,
  };
}

/** When schedule disabled, category is always visible (subject to channel + products). */
export function isCategoryShopScheduleVisible(
  schedule: unknown,
  at: Date,
  timezone = "Europe/Zurich"
): boolean {
  const normalized = normalizeCategoryShopSchedule(schedule);
  if (!normalized.enabled) return true;
  return isMenuScheduleActive(
    {
      isActive: true,
      scheduleType: normalized.scheduleType,
      daysOfWeek: normalized.daysOfWeek,
      daysOfMonth: normalized.daysOfMonth,
      timeRanges: normalized.timeRanges,
    },
    at,
    timezone
  );
}
