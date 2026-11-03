import { randomUUID } from "crypto";
import type { ReservationSettings } from "@/db/schema";

export type ReservationSlotPromoKind = "percent" | "free_wine" | "dine_free";

export type ReservationSlotPromo = {
  id: string;
  name: string;
  kind: ReservationSlotPromoKind;
  enabled?: boolean;
  scheduleMode?: "specific_days" | "whole_week";
  daysOfWeek?: string[];
  timeStart?: string | null;
  timeEnd?: string | null;
  /** When non-empty, only these HH:mm slots match (overrides range for matching). */
  specificTimes?: string[];
  percentOff?: number;
  /** dine_free: guests who pay (e.g. 3) */
  payCovers?: number;
  /** dine_free: total guests in deal (e.g. 4) */
  receiveCovers?: number;
  /** Optional line above the shop reservation peek widget */
  peekMessage?: string | null;
};

export type MatchedSlotPromo = {
  kind: ReservationSlotPromoKind;
  name: string;
  label: string;
  peekMessage: string | null;
  percentOff?: number;
  payCovers?: number;
  receiveCovers?: number;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function normalizeHm(hm: string): string {
  const p = parseHm(hm);
  if (p == null) return "";
  return `${pad2(Math.floor(p / 60))}:${pad2(p % 60)}`;
}

export function promoKindIcon(kind: ReservationSlotPromoKind): "percent" | "wine" | "dine" {
  if (kind === "free_wine") return "wine";
  if (kind === "dine_free") return "dine";
  return "percent";
}

export function defaultPromoLabel(p: ReservationSlotPromo): string {
  if (p.kind === "free_wine") return p.name?.trim() || "1 free wine bottle";
  if (p.kind === "dine_free") {
    const pay = Math.max(1, Number(p.payCovers) || 2);
    const recv = Math.max(pay + 1, Number(p.receiveCovers) || pay + 1);
    return p.name?.trim() || `Book ${recv} pay ${pay}`;
  }
  const pct = Math.min(90, Math.max(1, Number(p.percentOff) || 10));
  return p.name?.trim() || `${pct}% off`;
}

export function defaultPeekMessage(p: ReservationSlotPromo): string {
  const custom = p.peekMessage?.trim();
  if (custom) return custom;
  if (p.kind === "percent") {
    const pct = Math.min(90, Math.max(1, Number(p.percentOff) || 10));
    return `${pct}% off — click to explore. Available on selected days and times only.`;
  }
  if (p.kind === "free_wine") {
    return "Free wine bottle with your table — selected evenings only. Tap to book.";
  }
  const pay = Math.max(1, Number(p.payCovers) || 3);
  const recv = Math.max(pay + 1, Number(p.receiveCovers) || 4);
  return `Book for ${recv}, pay for ${pay}. This offer is only available on certain days and time slots.`;
}

function timeInPromoWindow(hm: string, p: ReservationSlotPromo): boolean {
  const normalized = normalizeHm(hm);
  const specific = (p.specificTimes || []).map(normalizeHm).filter(Boolean);
  if (specific.length > 0) {
    return specific.includes(normalized);
  }
  const cur = parseHm(normalized);
  if (cur == null) return false;
  const s = p.timeStart ? parseHm(p.timeStart) : null;
  const e = p.timeEnd ? parseHm(p.timeEnd) : null;
  if (s != null && e != null) return cur >= s && cur < e;
  if (s != null) return cur >= s;
  if (e != null) return cur < e;
  return true;
}

export function normalizeSlotPromos(
  raw: ReservationSettings["slotDiscounts"] | null | undefined
): ReservationSlotPromo[] {
  if (!Array.isArray(raw)) return [];
  const out: ReservationSlotPromo[] = [];
  for (const d of raw) {
    if (!d || d.enabled === false) continue;
    const kind: ReservationSlotPromoKind =
      d.kind === "free_wine" || d.kind === "dine_free" || d.kind === "percent"
        ? d.kind
        : Number(d.percentOff) > 0
          ? "percent"
          : "percent";
    const base = {
      id: String(d.id || randomUUID()),
      name: String(d.name || "").slice(0, 80),
      kind,
      enabled: d.enabled !== false,
      scheduleMode: d.scheduleMode === "whole_week" ? "whole_week" : "specific_days",
      daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek.map(String) : [],
      timeStart: d.timeStart || null,
      timeEnd: d.timeEnd || null,
      specificTimes: Array.isArray(d.specificTimes)
        ? d.specificTimes.map((t) => normalizeHm(String(t))).filter(Boolean)
        : [],
      peekMessage: d.peekMessage?.trim() || null,
    };
    if (kind === "percent") {
      const pct = Math.min(90, Math.max(1, Math.floor(Number(d.percentOff) || 0)));
      if (pct <= 0) continue;
      out.push({ ...base, percentOff: pct });
    } else if (kind === "free_wine") {
      out.push({ ...base, percentOff: 0 });
    } else {
      const pay = Math.max(1, Math.floor(Number(d.payCovers) || 3));
      const recv = Math.max(pay + 1, Math.floor(Number(d.receiveCovers) || pay + 1));
      out.push({ ...base, payCovers: pay, receiveCovers: recv });
    }
  }
  return out;
}

export function matchSlotPromoForSlot(
  promos: ReservationSlotPromo[],
  dayKey: string,
  hm: string
): MatchedSlotPromo | null {
  let best: { promo: ReservationSlotPromo; score: number } | null = null;
  for (const p of promos) {
    if (p.enabled === false) continue;
    const wholeWeek = p.scheduleMode === "whole_week";
    const days = p.daysOfWeek || [];
    if (!wholeWeek && days.length && !days.includes(dayKey)) continue;
    if (!timeInPromoWindow(hm, p)) continue;
    const score =
      p.kind === "percent"
        ? Number(p.percentOff) || 0
        : p.kind === "dine_free"
          ? 50 + (Number(p.receiveCovers) || 0)
          : 40;
    if (!best || score > best.score) best = { promo: p, score };
  }
  if (!best) return null;
  const p = best.promo;
  return {
    kind: p.kind,
    name: p.name || defaultPromoLabel(p),
    label: defaultPromoLabel(p),
    peekMessage: defaultPeekMessage(p),
    percentOff: p.kind === "percent" ? p.percentOff : undefined,
    payCovers: p.kind === "dine_free" ? p.payCovers : undefined,
    receiveCovers: p.kind === "dine_free" ? p.receiveCovers : undefined,
  };
}

export function peekBannerForDate(
  promos: ReservationSlotPromo[],
  dayKey: string,
  timeHm?: string | null
): { message: string; icon: "percent" | "wine" | "dine" } | null {
  const matches: MatchedSlotPromo[] = [];
  if (timeHm) {
    const one = matchSlotPromoForSlot(promos, dayKey, timeHm);
    if (one) matches.push(one);
  } else {
    const seen = new Set<string>();
    for (const p of promos) {
      if (p.enabled === false) continue;
      const wholeWeek = p.scheduleMode === "whole_week";
      const days = p.daysOfWeek || [];
      if (!wholeWeek && days.length && !days.includes(dayKey)) continue;
      const key = p.id;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        kind: p.kind,
        name: p.name,
        label: defaultPromoLabel(p),
        peekMessage: defaultPeekMessage(p),
        percentOff: p.percentOff,
        payCovers: p.payCovers,
        receiveCovers: p.receiveCovers,
      });
    }
  }
  if (!matches.length) return null;
  const pick = matches[0];
  return { message: pick.peekMessage || pick.label, icon: promoKindIcon(pick.kind) };
}

export { DAY_KEYS };
