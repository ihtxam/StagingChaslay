import { roundMoney2 } from "@/lib/money";
import { menuIncludesCatalogChannel, type CatalogChannel } from "@/lib/catalog-visibility";

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

const DEFAULT_TIMEZONE = "Europe/Zurich";

export function parseHm(time: string): number {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function isHmInWindow(curMinutes: number, start: string, end: string): boolean {
  const startM = parseHm(start);
  const endM = parseHm(end);
  if (startM <= endM) return curMinutes >= startM && curMinutes <= endM;
  return curMinutes >= startM || curMinutes <= endM;
}

export function normalizeTimeRanges(
  ranges: unknown,
  fallbackStart?: string | null,
  fallbackEnd?: string | null
): MenuTimeRange[] {
  const out: MenuTimeRange[] = [];
  if (Array.isArray(ranges)) {
    for (const row of ranges) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const start = String(r.start || "").trim();
      const end = String(r.end || "").trim();
      if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) continue;
      out.push({ start, end });
    }
  }
  if (!out.length && fallbackStart && fallbackEnd) {
    out.push({ start: fallbackStart, end: fallbackEnd });
  }
  if (!out.length) {
    out.push({ start: "00:00", end: "23:59" });
  }
  return out;
}

export function normalizeProductPrices(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(key || "").trim();
    if (!id) continue;
    const n = roundMoney2(Number(val));
    if (Number.isFinite(n) && n >= 0) out[id] = n;
  }
  return out;
}

type ZonedParts = {
  dow: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
};

function zonedParts(at: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dayMap[weekday] ?? at.getDay();
  const dayOfMonth = Number(parts.find((p) => p.type === "day")?.value || at.getDate());
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { dow, dayOfMonth, hour, minute };
}

export function isMenuScheduleActive(
  menu: ScheduledMenuLike,
  at: Date,
  timezone = DEFAULT_TIMEZONE
): boolean {
  if (menu.isActive === false) return false;

  const scheduleType = (menu.scheduleType || "weekly") as MenuScheduleType;
  const { dow, dayOfMonth, hour, minute } = zonedParts(at, timezone);
  const cur = hour * 60 + minute;

  if (scheduleType === "weekly") {
    const days = Array.isArray(menu.daysOfWeek) && menu.daysOfWeek.length
      ? menu.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(dow)) return false;
  } else if (scheduleType === "monthly") {
    const dom =
      Array.isArray(menu.daysOfMonth) && menu.daysOfMonth.length ? menu.daysOfMonth : [];
    if (dom.length && !dom.includes(dayOfMonth)) return false;
  }

  const ranges = normalizeTimeRanges(menu.timeRanges, menu.timeStart, menu.timeEnd);
  return ranges.some((r) => isHmInWindow(cur, r.start, r.end));
}

export function pickActiveScheduledMenu<T extends ScheduledMenuLike>(
  menus: T[],
  opts: {
    channel: CatalogChannel | string;
    locationId: string;
    at?: Date;
    timezone?: string;
  }
): T | null {
  const at = opts.at ?? new Date();
  const timezone = opts.timezone || DEFAULT_TIMEZONE;
  const active = menus
    .filter((m) => m.isActive !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

  const nonDefault = active.filter((m) => !m.isDefault);
  for (const menu of nonDefault) {
    if (!menuIncludesCatalogChannel(menu.channels, opts.channel as CatalogChannel)) continue;
    const locIds = Array.isArray(menu.locationIds) ? menu.locationIds : [];
    if (locIds.length && !locIds.includes(opts.locationId)) continue;
    if (isMenuScheduleActive(menu, at, timezone)) return menu;
  }

  const defaultMenu = active.find((m) => m.isDefault);
  if (defaultMenu) {
    if (!menuIncludesCatalogChannel(defaultMenu.channels, opts.channel as CatalogChannel)) return null;
    const locIds = Array.isArray(defaultMenu.locationIds) ? defaultMenu.locationIds : [];
    if (locIds.length && !locIds.includes(opts.locationId)) return null;
    return defaultMenu;
  }

  return null;
}

export function applyUniformPricing(basePrice: number, input: UniformPricingInput): number {
  const base = roundMoney2(Number(basePrice) || 0);
  const value = Number(input.value) || 0;
  if (input.mode === "fixed") {
    return roundMoney2(Math.max(0, base + value));
  }
  const dir = input.direction || (value < 0 ? "decrease" : "increase");
  const pct = Math.abs(value);
  const delta = roundMoney2((base * pct) / 100);
  if (dir === "decrease") return roundMoney2(Math.max(0, base - delta));
  return roundMoney2(base + delta);
}

export function applyUniformPricingToMap(
  basePrices: Record<string, number>,
  input: UniformPricingInput
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, price] of Object.entries(basePrices)) {
    out[id] = applyUniformPricing(price, input);
  }
  return out;
}

export type ProductWithPrice = {
  id: string;
  price: number | string;
  isOpenPrice?: boolean | null;
};

export function applyMenuProductPrices<T extends ProductWithPrice & Record<string, unknown>>(
  products: T[],
  menuPrices: Record<string, number> | null | undefined
): T[] {
  const map = normalizeProductPrices(menuPrices);
  if (!Object.keys(map).length) return products;
  return products.map((p) => {
    if (p.isOpenPrice) return p;
    const override = map[p.id];
    if (override == null || !Number.isFinite(override)) return p;
    const base = roundMoney2(Number(p.price) || 0);
    if (override === base) return p;
    return {
      ...p,
      price: override.toFixed(2),
      menuPriceApplied: true,
      catalogBasePrice: base,
    };
  });
}
