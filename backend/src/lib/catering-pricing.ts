import {
  clampGuestCount,
  normalizeCateringConfig,
  normalizeModifierPriceScope,
  type CateringConfig,
  type ModifierPriceScope,
} from "./catering-config";
import { roundMoney2 } from "./money";

export function computeCateringBaseUnit(
  listPrice: number,
  configRaw: unknown,
  guestCount: number
): { guestCount: number; baseUnit: number; config: CateringConfig } {
  const config = normalizeCateringConfig(configRaw);
  const guests = clampGuestCount(config, guestCount);
  const mode = config.pricingMode || "package";
  const packagePart =
    config.packagePrice != null && Number.isFinite(Number(config.packagePrice))
      ? Number(config.packagePrice)
      : roundMoney2(listPrice);
  const perPerson = Math.max(0, Number(config.perPersonPrice) || 0);

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
}): { unitPrice: number; guestCount: number } {
  const { guestCount, baseUnit } = computeCateringBaseUnit(
    input.listPrice,
    input.cateringConfig,
    input.guestCount
  );
  const unitPrice = roundMoney2(
    baseUnit + input.deliveryMarkup + input.extrasTotal + input.comboSurcharge
  );
  return { unitPrice, guestCount };
}
