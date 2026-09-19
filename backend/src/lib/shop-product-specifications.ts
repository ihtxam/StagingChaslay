import { roundMoney2 } from "@/lib/money";

export type ProductSpecRow = {
  id?: string;
  name?: string;
  price?: number | string;
  saleStatus?: string;
  isDefault?: boolean;
  sortOrder?: number;
};

/** Matches client synthetic size group id in shop-modifier-utils. */
export const SHOP_SIZE_MODIFIER_GROUP_ID = "__sizes__";

export function inStockProductSpecifications(
  specifications: unknown
): Array<{ id: string; name: string; price: number; isDefault: boolean }> {
  if (!Array.isArray(specifications)) return [];
  return specifications
    .filter(
      (raw): raw is ProductSpecRow =>
        !!raw &&
        typeof raw === "object" &&
        typeof (raw as ProductSpecRow).name === "string" &&
        !!(raw as ProductSpecRow).name?.trim() &&
        ((raw as ProductSpecRow).saleStatus || "in_stock") !== "out_of_stock"
    )
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((s, i) => ({
      id: String(s.id || `spec-${i + 1}`).trim(),
      name: String(s.name).trim(),
      price: roundMoney2(Number(s.price) || 0),
      isDefault: !!s.isDefault,
    }));
}

export function specificationOptionPriceDelta(basePrice: number, specPrice: number): number {
  return roundMoney2(specPrice - roundMoney2(basePrice));
}
