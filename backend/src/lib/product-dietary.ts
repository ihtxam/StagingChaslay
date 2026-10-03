/** Dietary / packaging labels for shop menu filtering (ezCater-style). */

export type DietaryTagId =
  | "individual_packaging"
  | "gluten_free"
  | "vegan"
  | "vegetarian";

export type DietaryTagDef = {
  id: DietaryTagId;
  /** Short badge on product cards (GF, VG, V, IP) */
  badge: string;
  /** i18n key for full label in product detail */
  labelKey: string;
  /** Circle badge color */
  color: string;
};

export const DIETARY_TAGS: DietaryTagDef[] = [
  {
    id: "individual_packaging",
    badge: "IP",
    labelKey: "shopDietaryIndividualPackaging",
    color: "#334155",
  },
  {
    id: "gluten_free",
    badge: "GF",
    labelKey: "shopDietaryGlutenFree",
    color: "#0f172a",
  },
  {
    id: "vegan",
    badge: "VG",
    labelKey: "shopDietaryVegan",
    color: "#15803d",
  },
  {
    id: "vegetarian",
    badge: "V",
    labelKey: "shopDietaryVegetarian",
    color: "#15803d",
  },
];

const VALID = new Set(DIETARY_TAGS.map((t) => t.id));

export function normalizeDietaryTags(raw: unknown): DietaryTagId[] {
  if (!Array.isArray(raw)) return [];
  const out: DietaryTagId[] = [];
  for (const v of raw) {
    const id = String(v || "").trim().toLowerCase();
    if (VALID.has(id as DietaryTagId) && !out.includes(id as DietaryTagId)) {
      out.push(id as DietaryTagId);
    }
  }
  return out;
}

export function productMatchesDietaryFilters(
  productTags: DietaryTagId[] | unknown,
  activeFilters: DietaryTagId[]
): boolean {
  if (!activeFilters.length) return true;
  const tags = normalizeDietaryTags(productTags);
  return activeFilters.every((f) => tags.includes(f));
}

export function dietaryTagDef(id: DietaryTagId): DietaryTagDef | undefined {
  return DIETARY_TAGS.find((t) => t.id === id);
}
