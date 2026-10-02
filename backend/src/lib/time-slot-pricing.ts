import { roundMoney2 } from "@/lib/money";

export type TimeSlotPricingSlot = {
  id: string;
  start: string;
  end: string;
  label?: string | null;
};

export type TimeSlotPricingSettings = {
  enabled: boolean;
  slots: TimeSlotPricingSlot[];
};

export type ProductTimeSlotPriceEntry = {
  price?: number | null;
  multiplier?: number | null;
};

export type ProductTimeSlotPrices = Record<string, ProductTimeSlotPriceEntry>;

export type ResolvedProductPrice = {
  basePrice: number;
  resolvedPrice: number;
  activeSlotId: string | null;
  activeSlotLabel: string | null;
  applied: boolean;
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

export function slotsOverlap(a: TimeSlotPricingSlot, b: TimeSlotPricingSlot): boolean {
  const probe = (m: number) =>
    isHmInWindow(m, a.start, a.end) && isHmInWindow(m, b.start, b.end);
  for (let m = 0; m < 24 * 60; m += 15) {
    if (probe(m)) return true;
  }
  return false;
}

export function localMinutesInTimezone(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function newSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeTimeSlotPricingSettings(raw: unknown): TimeSlotPricingSettings {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const slotsRaw = Array.isArray(src.slots) ? src.slots : [];
  const slots: TimeSlotPricingSlot[] = [];
  for (const row of slotsRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const start = String(r.start || "").trim();
    const end = String(r.end || "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) continue;
    const id = String(r.id || "").trim() || newSlotId();
    const label = r.label != null ? String(r.label).trim().slice(0, 80) : null;
    slots.push({ id, start, end, label: label || null });
  }
  return {
    enabled: src.enabled === true,
    slots,
  };
}

export function normalizeProductTimeSlotPrices(raw: unknown): ProductTimeSlotPrices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ProductTimeSlotPrices = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const slotId = String(key || "").trim();
    if (!slotId || !val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    const price =
      v.price === null || v.price === undefined || v.price === ""
        ? null
        : roundMoney2(Number(v.price));
    const multiplier =
      v.multiplier === null || v.multiplier === undefined || v.multiplier === ""
        ? null
        : Number(v.multiplier);
    const entry: ProductTimeSlotPriceEntry = {};
    if (price != null && Number.isFinite(price) && price >= 0) entry.price = price;
    if (multiplier != null && Number.isFinite(multiplier) && multiplier > 0) {
      entry.multiplier = multiplier;
    }
    if (entry.price != null || entry.multiplier != null) out[slotId] = entry;
  }
  return out;
}

export function findActiveTimeSlot(
  settings: TimeSlotPricingSettings,
  at: Date,
  timezone: string
): TimeSlotPricingSlot | null {
  if (!settings.enabled || !settings.slots.length) return null;
  const cur = localMinutesInTimezone(at, timezone);
  for (const slot of settings.slots) {
    if (isHmInWindow(cur, slot.start, slot.end)) return slot;
  }
  return null;
}

export type ProductPriceInput = {
  price: number | string;
  timeSlotPrices?: unknown;
  isOpenPrice?: boolean | null;
};

export function resolveProductPrice(
  product: ProductPriceInput,
  merchantSettings: TimeSlotPricingSettings,
  opts?: { at?: Date; timezone?: string }
): ResolvedProductPrice {
  const basePrice = roundMoney2(Number(product.price) || 0);
  const at = opts?.at ?? new Date();
  const timezone = opts?.timezone || DEFAULT_TIMEZONE;

  if (!merchantSettings.enabled || product.isOpenPrice) {
    return {
      basePrice,
      resolvedPrice: basePrice,
      activeSlotId: null,
      activeSlotLabel: null,
      applied: false,
    };
  }

  const active = findActiveTimeSlot(merchantSettings, at, timezone);
  if (!active) {
    return {
      basePrice,
      resolvedPrice: basePrice,
      activeSlotId: null,
      activeSlotLabel: null,
      applied: false,
    };
  }

  const map = normalizeProductTimeSlotPrices(product.timeSlotPrices);
  const entry = map[active.id];
  if (!entry) {
    return {
      basePrice,
      resolvedPrice: basePrice,
      activeSlotId: active.id,
      activeSlotLabel: active.label || null,
      applied: false,
    };
  }

  let resolved = basePrice;
  if (entry.price != null && Number.isFinite(entry.price)) {
    resolved = roundMoney2(entry.price);
  } else if (entry.multiplier != null && Number.isFinite(entry.multiplier)) {
    resolved = roundMoney2(basePrice * entry.multiplier);
  }

  return {
    basePrice,
    resolvedPrice: resolved,
    activeSlotId: active.id,
    activeSlotLabel: active.label || null,
    applied: resolved !== basePrice,
  };
}

export function withResolvedProductPrice<T extends ProductPriceInput & Record<string, unknown>>(
  product: T,
  merchantSettings: TimeSlotPricingSettings,
  opts?: { at?: Date; timezone?: string }
): T & {
  price: string;
  catalogBasePrice?: number;
  timeSlotPricing?: ResolvedProductPrice;
} {
  const resolved = resolveProductPrice(product, merchantSettings, opts);
  return {
    ...product,
    price: resolved.resolvedPrice.toFixed(2),
    catalogBasePrice: resolved.basePrice,
    timeSlotPricing: resolved,
  };
}

export function applyTimeSlotPricingToProducts<
  T extends ProductPriceInput & Record<string, unknown>,
>(
  merchant: { timeSlotPricingSettings?: unknown },
  products: T[],
  opts?: { at?: Date; timezone?: string }
): T[] {
  const settings = normalizeTimeSlotPricingSettings(merchant.timeSlotPricingSettings);
  if (!settings.enabled) return products;
  return products.map((p) => withResolvedProductPrice(p, settings, opts));
}
