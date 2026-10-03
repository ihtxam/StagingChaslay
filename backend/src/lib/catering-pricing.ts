import {
  clampGuestCount,
  normalizeCateringConfig,
  normalizeModifierPriceScope,
  type CateringConfig,
  type ModifierPriceScope,
} from "./catering-config";
import { roundMoney2 } from "./money";

export type ComboPickForCateringPricing = {
  slotId: string;
  extraPrice: number;
  qty?: number;
  selectedExtras?: Array<{ price: number }>;
};

/** Split combo picks into tier per-person rate (one slot) vs flat surcharges on other slots. */
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
    const nested = roundMoney2(
      (pick.selectedExtras || []).reduce((s, e) => s + (Number(e.price) || 0), 0)
    );
    const pickUnit = roundMoney2((Number(pick.extraPrice) || 0) + nested);
    const mult = Math.max(1, Math.floor(pick.qty ?? 1) || 1);
    if (tierSlotId && pick.slotId === tierSlotId) {
      tierPerPersonRate = roundMoney2(Number(pick.extraPrice) || 0);
      comboSurchargeFlat += roundMoney2(nested * mult);
    } else {
      comboSurchargeFlat += roundMoney2(pickUnit * mult);
    }
  }

  return { guestCount: guests, tierPerPersonRate, comboSurchargeFlat };
}

export function computeCateringBaseUnit(
  listPrice: number,
  configRaw: unknown,
  guestCount: number,
  tierPerPersonRate?: number | null
): { guestCount: number; baseUnit: number; config: CateringConfig } {
  const config = normalizeCateringConfig(configRaw);
  const guests = clampGuestCount(config, guestCount);
  const mode = config.pricingMode || "package";
  const packagePart =
    config.packagePrice != null && Number.isFinite(Number(config.packagePrice))
      ? Number(config.packagePrice)
      : roundMoney2(listPrice);
  let perPerson = Math.max(0, Number(config.perPersonPrice) || 0);
  if (tierPerPersonRate != null && Number.isFinite(Number(tierPerPersonRate))) {
    perPerson = Math.max(0, Number(tierPerPersonRate));
  }

  let baseUnit = packagePart;
  if (mode === "per_person") {
    baseUnit = roundMoney2(perPerson * guests);
  } else if (mode === "mixed") {
    baseUnit = roundMoney2(packagePart + perPerson * guests);
  } else {
    baseUnit = roundMoney2(packagePart);
  }

  return { guestCount: guests, baseUnit, config };
}

/** Apply catering multiplier to a modifier/catalog extra price. */
export function scaleModifierPrice(
  unitPrice: number,
  priceScope: ModifierPriceScope | unknown,
  guestCount: number,
  cateringEnabled: boolean
): number {
  const scope = normalizeModifierPriceScope(priceScope);
  if (!cateringEnabled || scope !== "per_guest") {
    return roundMoney2(unitPrice);
  }
  const guests = Math.max(1, Math.floor(guestCount) || 1);
  return roundMoney2(unitPrice * guests);
}

export function computeCateringLineUnitPrice(input: {
  listPrice: number;
  cateringConfig: unknown;
  guestCount: number;
  comboSurcharge: number;
  extrasTotal: number;
  deliveryMarkup: number;
  tierPerPersonRate?: number | null;
}): { unitPrice: number; guestCount: number } {
  const { guestCount, baseUnit } = computeCateringBaseUnit(
    input.listPrice,
    input.cateringConfig,
    input.guestCount,
    input.tierPerPersonRate
  );
  const unitPrice = roundMoney2(
    baseUnit + input.deliveryMarkup + input.extrasTotal + input.comboSurcharge
  );
  return { unitPrice, guestCount };
}
