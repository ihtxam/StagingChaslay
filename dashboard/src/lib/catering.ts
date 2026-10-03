export type CateringPricingMode = 'package' | 'per_person' | 'mixed';

export type CateringConfig = {
  enabled?: boolean;
  pricingMode?: CateringPricingMode;
  packagePrice?: number | null;
  perPersonPrice?: number | null;
  minGuests?: number;
  maxGuests?: number;
  defaultGuests?: number;
  tierSlotId?: string | null;
};

export type ModifierPriceScope = 'fixed' | 'per_guest';

export type ComboPickForCateringPricing = {
  slotId: string;
  extraPrice: number;
  qty?: number;
  selectedExtras?: Array<{ price: number }>;
};

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
    tierSlotId:
      typeof o.tierSlotId === 'string' && o.tierSlotId.trim() ? o.tierSlotId.trim() : null,
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

export function resolveCateringComboPricing(input: {
  cateringConfig: unknown;
  guestCount: number;
  comboPicks: ComboPickForCateringPricing[];
}): {
  guestCount: number;
  tierPerPersonRate: number | null;
  comboSurchargeFlat: number;
} {
  const config = normalizeCateringConfig(input.cateringConfig);
  const guests = clampGuestCount(config, input.guestCount);
  const tierSlotId = config.tierSlotId?.trim() || null;
  let tierPerPersonRate: number | null = null;
  let comboSurchargeFlat = 0;

  for (const pick of input.comboPicks) {
    const nested = Math.round(
      (pick.selectedExtras || []).reduce((s, e) => s + (Number(e.price) || 0), 0) * 100
    ) / 100;
    const pickUnit =
      Math.round(((Number(pick.extraPrice) || 0) + nested) * 100) / 100;
    const mult = Math.max(1, Math.floor(pick.qty ?? 1) || 1);
    if (tierSlotId && pick.slotId === tierSlotId) {
      tierPerPersonRate = Math.round((Number(pick.extraPrice) || 0) * 100) / 100;
      comboSurchargeFlat += Math.round(nested * mult * 100) / 100;
    } else {
      comboSurchargeFlat += Math.round(pickUnit * mult * 100) / 100;
    }
  }

  return { guestCount: guests, tierPerPersonRate, comboSurchargeFlat };
}

export function computeCateringBaseUnit(
  listPrice: number,
  configRaw: unknown,
  guestCount: number,
  tierPerPersonRate?: number | null
): { guestCount: number; baseUnit: number } {
  const config = normalizeCateringConfig(configRaw);
  const guests = clampGuestCount(config, guestCount);
  const mode = config.pricingMode || 'package';
  const packagePart =
    config.packagePrice != null && Number.isFinite(Number(config.packagePrice))
      ? Number(config.packagePrice)
      : Math.round(listPrice * 100) / 100;
  let perPerson = Math.max(0, Number(config.perPersonPrice) || 0);
  if (tierPerPersonRate != null && Number.isFinite(Number(tierPerPersonRate))) {
    perPerson = Math.max(0, Number(tierPerPersonRate));
  }
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
  tierPerPersonRate?: number | null;
}): number {
  const { baseUnit } = computeCateringBaseUnit(
    input.listPrice,
    input.cateringConfig,
    input.guestCount,
    input.tierPerPersonRate
  );
  return Math.round((baseUnit + input.comboSurcharge + input.extrasTotal) * 100) / 100;
}
