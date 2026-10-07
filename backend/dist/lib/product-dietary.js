"use strict";
/** Dietary / packaging labels for shop menu filtering (ezCater-style). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIETARY_TAGS = void 0;
exports.normalizeDietaryTags = normalizeDietaryTags;
exports.productMatchesDietaryFilters = productMatchesDietaryFilters;
exports.dietaryTagDef = dietaryTagDef;
exports.DIETARY_TAGS = [
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
const VALID = new Set(exports.DIETARY_TAGS.map((t) => t.id));
function normalizeDietaryTags(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const v of raw) {
        const id = String(v || "").trim().toLowerCase();
        if (VALID.has(id) && !out.includes(id)) {
            out.push(id);
        }
    }
    return out;
}
function productMatchesDietaryFilters(productTags, activeFilters) {
    if (!activeFilters.length)
        return true;
    const tags = normalizeDietaryTags(productTags);
    return activeFilters.every((f) => tags.includes(f));
}
function dietaryTagDef(id) {
    return exports.DIETARY_TAGS.find((t) => t.id === id);
}
//# sourceMappingURL=product-dietary.js.map