export type CateringPricingMode = 'package' | 'per_person' | 'mixed';

export type CateringConfig = {
  enabled?: boolean;
  pricingMode?: CateringPricingMode;
  packagePrice?: number | null;
  perPersonPrice?: number | null;
  minGuests?: number;
  maxGuests?: number;
  defaultGuests?: number;
};

export type ModifierPriceScope = 'fixed' | 'per_guest';

export function normalizeCateringConfig(raw: unknown): CateringConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mode = String(o.pricingMode || 'package').toLowerCase();
  const pricingMode: CateringPricingMode =
    mode === 'per_person' || mode === 'mixed' ? mode : 'package';
  const num = (k: string) => {
    const v = o[k];
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    enabled: o.enabled === true,
    pricingMode,
    packagePrice: num('packagePrice') ?? null,
    perPersonPrice: num('perPersonPrice') ?? null,
    minGuests: num('minGuests') != null ? Math.max(1, Math.floor(num('minGuests')!)) : undefined,
    maxGuests: num('maxGuests') != null ? Math.max(1, Math.floor(num('maxGuests')!)) : undefined,
    defaultGuests:
      num('defaultGuests') != null ? Math.max(1, Math.floor(num('defaultGuests')!)) : undefined,
  };
}

export function isCateringProduct(
  productType: string | undefined,
  config: CateringConfig | unknown
): boolean {
  if (productType !== 'combo') return false;
  return normalizeCateringConfig(config).enabled === true;
}

export function clampGuestCount(config: CateringConfig, requested: number): number {
  const min = config.minGuests ?? 1;
  const max = config.maxGuests ?? 999;
  const n = Math.floor(Number(requested) || config.defaultGuests || min);
  return Math.min(max, Math.max(min, n));
}

export function scaleModifierPrice(
  unitPrice: number,
  priceScope: ModifierPriceScope | string | undefined,
  guestCount: number,
  cateringEnabled: boolean
): number {
  const scope = String(priceScope || 'fixed').toLowerCase();
  if (!cateringEnabled || scope !== 'per_guest') {
    return Math.round(unitPrice * 100) / 100;
  }
  const guests = Math.max(1, Math.floor(guestCount) || 1);
  return Math.round(unitPrice * guests * 100) / 100;
}

export function computeCateringBaseUnit(
  listPrice: number,
  configRaw: unknown,
  guestCount: number
): { guestCount: number; baseUnit: number } {
  const config = normalizeCateringConfig(configRaw);
  const guests = clampGuestCount(config, guestCount);
  const mode = config.pricingMode || 'package';
  const packagePart =
    config.packagePrice != null && Number.isFinite(Number(config.packagePrice))
      ? Number(config.packagePrice)
      : Math.round(listPrice * 100) / 100;
  const perPerson = Math.max(0, Number(config.perPersonPrice) || 0);
  let baseUnit = packagePart;
  if (mode === 'per_person') {
    baseUnit = Math.round(perPerson * guests * 100) / 100;
  } else if (mode === 'mixed') {
    baseUnit = Math.round((packagePart + perPerson * guests) * 100) / 100;
  } else {
    baseUnit = Math.round(packagePart * 100) / 100;
  }
  return { guestCount: guests, baseUnit };
}

export function computeCateringUnitPrice(input: {
  listPrice: number;
  cateringConfig: unknown;
  guestCount: number;
  comboSurcharge: number;
  extrasTotal: number;
}): number {
  const { baseUnit, guestCount } = computeCateringBaseUnit(
    input.listPrice,
    input.cateringConfig,
    input.guestCount
  );
  void guestCount;
  return (
    Math.round((baseUnit + input.comboSurcharge + input.extrasTotal) * 100) / 100
  );
}
