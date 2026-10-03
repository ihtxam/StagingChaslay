/** Flexible catering / prepackaged menu settings on combo products. */

export type CateringPricingMode = "package" | "per_person" | "mixed";

export type CateringConfig = {
  /** Enable guest-count pricing and per-guest add-ons for this combo. */
  enabled?: boolean;
  /** package = flat menu price; per_person = rate × guests; mixed = package + rate × guests */
  pricingMode?: CateringPricingMode;
  /** Flat package portion (defaults to product list price when omitted). */
  packagePrice?: number | null;
  /** Per-guest portion (CHF × guest count). */
  perPersonPrice?: number | null;
  minGuests?: number;
  maxGuests?: number;
  defaultGuests?: number;
};

export type ModifierPriceScope = "fixed" | "per_guest";

export function normalizeCateringConfig(raw: unknown): CateringConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = String(o.pricingMode || "package").toLowerCase();
  const pricingMode: CateringPricingMode =
    mode === "per_person" || mode === "mixed" ? mode : "package";
  const num = (k: string) => {
    const v = o[k];
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    enabled: o.enabled === true,
    pricingMode,
    packagePrice: num("packagePrice") ?? null,
    perPersonPrice: num("perPersonPrice") ?? null,
    minGuests: num("minGuests") != null ? Math.max(1, Math.floor(num("minGuests")!)) : undefined,
    maxGuests: num("maxGuests") != null ? Math.max(1, Math.floor(num("maxGuests")!)) : undefined,
    defaultGuests:
      num("defaultGuests") != null ? Math.max(1, Math.floor(num("defaultGuests")!)) : undefined,
  };
}

export function isCateringProduct(
  productType: string | null | undefined,
  config: CateringConfig | unknown
): boolean {
  if (productType !== "combo") return false;
  return normalizeCateringConfig(config).enabled === true;
}

export function clampGuestCount(config: CateringConfig, requested: number): number {
  const min = config.minGuests ?? 1;
  const max = config.maxGuests ?? 999;
  const n = Math.floor(Number(requested) || config.defaultGuests || min);
  return Math.min(max, Math.max(min, n));
}

export function normalizeModifierPriceScope(raw: unknown): ModifierPriceScope {
  return String(raw || "fixed").toLowerCase() === "per_guest" ? "per_guest" : "fixed";
}
